import os
import re
import time
import uuid
from typing import Any, Dict, List, Optional

import torch
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import SessionLocal, Doctor, Patient, Xray, Analysis
from predictor import (
    
    BASE_DIR,
    DEVICE,
    MODEL_REGISTRY,
    _checkpoint_path,
    infer_bone_type_from_text,
    normalize_bone_type,
    predict_batch,
    validate_checkpoints,
)
from auth import (
    get_current_doctor,
    login_user,
    register_user,
    _doctor_to_dict,
    hash_password,
    generate_2fa_secret,
    generate_qr_code,
    verify_totp,
    verify_2fa_token,
    verify_password,
)

app = FastAPI(title="OsseoAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("static",  exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/static",  StaticFiles(directory="static"),  name="static")


# ═══════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/model-health")
def model_health(doctor: Doctor = Depends(get_current_doctor)):
    _require_approved(doctor)
    return validate_checkpoints()


@app.get("/api/model-health/detailed")
def model_health_detailed(doctor: Doctor = Depends(get_current_doctor)):
    """
    Detailed model health: file sizes, modification times, device info.
    FIX: All referenced names (_checkpoint_path, MODEL_REGISTRY, DEVICE, BASE_DIR, torch)
         are now properly imported from predictor.py at the top of this file.
    """
    _require_approved(doctor)

    registry = {
        "general": {"ckpt": _checkpoint_path("general_best.pth"), "kind": "general"},
        **{
            bone: {"ckpt": _checkpoint_path(cfg["ckpt"]), "kind": "specialist"}
            for bone, cfg in MODEL_REGISTRY.items()
        },
    }

    report = {
        "device":       str(DEVICE),
        "torch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "cuda_device":  torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "checkpoints":  {},
        "timestamp":    time.time(),
    }

    for name, cfg in registry.items():
        ckpt_path = cfg["ckpt"]
        entry: Dict[str, Any] = {
            "path":          ckpt_path,
            "relative_path": ckpt_path.replace(BASE_DIR, "."),
            "exists":        os.path.exists(ckpt_path),
        }

        if entry["exists"]:
            try:
                stat = os.stat(ckpt_path)
                entry["size_mb"]  = round(stat.st_size / (1024 * 1024), 2)
                entry["modified"] = stat.st_mtime
                entry["status"]   = "✓ OK"
            except Exception as exc:
                entry["status"] = f"✗ Error: {exc}"
        else:
            entry["status"] = "✗ Missing"

        report["checkpoints"][name] = entry

    return report


# ═══════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════

@app.post("/api/auth/register")
def register(
    email:      str = Form(...),
    password:   str = Form(...),
    full_name:  str = Form(...),
    specialty:  str = Form(""),
    hospital:   str = Form(""),
    license_no: str = Form(""),
):
    return register_user(email, password, full_name, specialty, hospital, license_no)


@app.post("/api/auth/login")
def login(email: str = Form(...), password: str = Form(...)):
    return login_user(email, password)


@app.post("/api/auth/verify-2fa")
def verify_2fa(temp_token: str = Form(...), totp_code: str = Form(...)):
    return verify_2fa_token(temp_token, totp_code)


@app.post("/api/auth/setup-2fa")
def setup_2fa(doctor: Doctor = Depends(get_current_doctor)):
    secret  = generate_2fa_secret()
    qr_code = generate_qr_code(secret, doctor.email)
    return {"secret": secret, "qr_code": qr_code, "manual_entry_key": secret}


@app.post("/api/auth/enable-2fa")
def enable_2fa(
    secret:    str = Form(...),
    totp_code: str = Form(...),
    doctor: Doctor = Depends(get_current_doctor),
):
    if not verify_totp(secret, totp_code):
        raise HTTPException(400, "Invalid 2FA code")

    db  = SessionLocal()
    doc = db.query(Doctor).filter(Doctor.id == doctor.id).first()
    if not doc:
        db.close()
        raise HTTPException(404, "Doctor not found")

    doc.two_factor_secret  = secret
    doc.two_factor_enabled = True
    db.commit()
    db.close()
    return {"status": "2FA enabled", "two_factor_enabled": True}


@app.post("/api/auth/disable-2fa")
def disable_2fa(
    password: str = Form(...),
    doctor: Doctor = Depends(get_current_doctor),
):
    db  = SessionLocal()
    doc = db.query(Doctor).filter(Doctor.id == doctor.id).first()
    if not doc or not verify_password(password, doc.password):
        db.close()
        raise HTTPException(401, "Invalid password")

    doc.two_factor_enabled = False
    doc.two_factor_secret  = None
    db.commit()
    db.close()
    return {"status": "2FA disabled", "two_factor_enabled": False}


@app.get("/api/auth/me")
def me(doctor: Doctor = Depends(get_current_doctor)):
    return _doctor_to_dict(doctor)


# ═══════════════════════════════════════════════════════════
# PATIENTS
# ═══════════════════════════════════════════════════════════

@app.post("/api/patients")
def create_patient(
    full_name:     str = Form(...),
    date_of_birth: str = Form(""),
    gender:        str = Form(""),
    phone:         str = Form(""),
    notes:         str = Form(""),
    doctor: Doctor = Depends(get_current_doctor),
):
    _require_approved(doctor)
    db = SessionLocal()
    p  = Patient(
        doctor_id     = doctor.id,
        full_name     = full_name,
        date_of_birth = date_of_birth,
        gender        = gender,
        phone         = phone,
        notes         = notes,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    db.close()
    return _patient_dict(p)


@app.get("/api/patients")
def list_patients(doctor: Doctor = Depends(get_current_doctor)):
    _require_approved(doctor)
    db   = SessionLocal()
    rows = (
        db.query(Patient)
        .filter(Patient.doctor_id == doctor.id)
        .order_by(Patient.created_at.desc())
        .all()
    )
    db.close()
    return [_patient_dict(p) for p in rows]


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: int, doctor: Doctor = Depends(get_current_doctor)):
    _require_approved(doctor)
    db = SessionLocal()
    p  = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.doctor_id == doctor.id,
    ).first()
    if not p:
        db.close()
        raise HTTPException(404, "Patient not found")

    xrays    = db.query(Xray).filter(Xray.patient_id == patient_id).all()
    analyses = (
        db.query(Analysis)
        .filter(Analysis.patient_id == patient_id)
        .order_by(Analysis.created_at.desc())
        .all()
    )
    db.close()
    return {
        **_patient_dict(p),
        "xrays":    [_xray_dict(x) for x in xrays],
        "analyses": [_analysis_dict(a) for a in analyses],
    }


@app.put("/api/patients/{patient_id}/notes")
def update_notes(
    patient_id: int,
    notes: str = Form(...),
    doctor: Doctor = Depends(get_current_doctor),
):
    db = SessionLocal()
    p  = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.doctor_id == doctor.id,
    ).first()
    if not p:
        db.close()
        raise HTTPException(404, "Patient not found")
    p.notes = notes
    db.commit()
    db.close()
    return {"updated": True}


@app.put("/api/patients/{patient_id}")
def update_patient(
    patient_id:    int,
    full_name:     str = Form(...),
    date_of_birth: str = Form(""),
    gender:        str = Form(""),
    phone:         str = Form(""),
    notes:         str = Form(""),
    doctor: Doctor = Depends(get_current_doctor),
):
    db = SessionLocal()
    p  = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.doctor_id == doctor.id,
    ).first()
    if not p:
        db.close()
        raise HTTPException(404, "Patient not found")

    p.full_name     = full_name
    p.date_of_birth = date_of_birth
    p.gender        = gender
    p.phone         = phone
    p.notes         = notes
    db.commit()
    db.refresh(p)
    db.close()
    return _patient_dict(p)


@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int, doctor: Doctor = Depends(get_current_doctor)):
    db = SessionLocal()
    p  = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.doctor_id == doctor.id,
    ).first()
    if not p:
        db.close()
        raise HTTPException(404, "Patient not found")
    db.delete(p)
    db.commit()
    db.close()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════
# ANALYZE  (existing patient — single or batch)
# ═══════════════════════════════════════════════════════════

@app.post("/api/patients/{patient_id}/analyze")
async def analyze(
    patient_id: int,
    file:        UploadFile       = File(None),
    files:       List[UploadFile] = File(None),
    file_relative_paths: List[str] = Form(None),
    bone_type:   Optional[str]    = Form(None),
    doctor: Doctor = Depends(get_current_doctor),
):
    _require_approved(doctor)

    all_files: List[UploadFile] = []
    if files: all_files.extend(files)
    if file:  all_files.insert(0, file)
    if not all_files:
        raise HTTPException(400, "No files uploaded")

    db = SessionLocal()
    p  = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.doctor_id == doctor.id,
    ).first()
    if not p:
        db.close()
        raise HTTPException(404, "Patient not found")
    db.close()

    patient_folder = f"uploads/patient_{patient_id}"
    os.makedirs(patient_folder, exist_ok=True)

    relative_paths = file_relative_paths or []
    batch_inputs: List[Dict[str, Any]] = []

    for idx, upload in enumerate(all_files):
        img_bytes = await upload.read()
        if not img_bytes:
            continue
        display_name = (
            relative_paths[idx]
            if idx < len(relative_paths) and relative_paths[idx]
            else upload.filename
        )
        batch_inputs.append({"filename": display_name or "image.jpg", "bytes": img_bytes})

    if not batch_inputs:
        raise HTTPException(400, "Uploaded files were empty")

    try:
        inferred_bone = normalize_bone_type(bone_type) or infer_bone_type_from_text(
            *(e["filename"] for e in batch_inputs)
        )
        batch_result = predict_batch(batch_inputs, bone_override=inferred_bone)
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))

    if "error" in batch_result:
        raise HTTPException(400, batch_result["error"])

    model_rows    = batch_result.get("results", [])
    study_uid     = str(uuid.uuid4())
    study_summary = batch_result.get("summary", {})
    study_fracture    = bool(study_summary.get("fracture_detected", False))
    study_confidence  = float(study_summary.get("study_confidence", 0.0))
    study_probability = float(study_summary.get("study_probability", 0.0))
    study_threshold   = float(study_summary.get("threshold", 0.5))

    saved_results: List[Dict[str, Any]] = []
    xray_rows: List[Dict[str, Any]] = []
    db = SessionLocal()

    for idx, (row_input, result) in enumerate(zip(batch_inputs, model_rows)):
        clean_name    = _sanitize_filename(row_input["filename"])
        safe_name     = f"{uuid.uuid4()}_{clean_name}"
        image_rel     = f"{patient_folder}/{safe_name}"
        with open(image_rel, "wb") as fh:
            fh.write(row_input["bytes"])

        xray = Xray(
            patient_id    = patient_id,
            filename      = row_input["filename"],
            file_path     = image_rel,
            bone_type     = batch_result.get("bone_type") or result.get("bone_type", "unknown"),
            study_uid     = study_uid,
            fracture      = study_fracture,
            confidence    = study_confidence,
            model_used    = batch_result.get("model_used", result.get("model_used", "specialist")),
            attention_score = float(result.get("attention_score", 0.0)),
        )
        db.add(xray)
        db.flush()
        xray_rows.append({"xray": xray, "result": result, "safe_name": safe_name, "image_rel": image_rel})

    selected_index = int(batch_result.get("selected_index", 0))
    if not (0 <= selected_index < len(xray_rows)):
        selected_index = 0

    sel = xray_rows[selected_index]
    gradcam_rel = ""
    if sel["result"].get("gradcam_png"):
        gname       = f"gradcam_{os.path.splitext(sel['safe_name'])[0]}.png"
        gradcam_rel = f"{patient_folder}/{gname}"
        with open(gradcam_rel, "wb") as fh:
            fh.write(sel["result"]["gradcam_png"])
        sel["xray"].gradcam_path = gradcam_rel

    analysis = Analysis(
        xray_id           = sel["xray"].id,
        patient_id        = patient_id,
        bone_type         = batch_result.get("bone_type") or sel["result"].get("bone_type", "unknown"),
        probability       = study_probability,
        fracture          = study_fracture,
        confidence        = study_confidence,
        threshold         = study_threshold,
        study_uid         = study_uid,
        gradcam_path      = gradcam_rel,
        router_probability = float(batch_result.get("router_probability", 0.0)),
        bone_confidence   = float(batch_result.get("bone_confidence", 0.0)),
        model_used        = batch_result.get("model_used", "specialist"),
    )
    db.add(analysis)
    db.flush()

    for idx, row in enumerate(xray_rows):
        result = row["result"]
        saved_results.append({
            **{k: v for k, v in result.items() if k != "gradcam_png"},
            "filename":    row["xray"].filename,
            "xray_id":     row["xray"].id,
            "analysis_id": analysis.id,
            "study_uid":   study_uid,
            "image_path":  _to_web_path(row["image_rel"]),
            "gradcam_path": _to_web_path(gradcam_rel) if idx == selected_index else "",
        })

    db.commit()
    db.close()

    return {
        **{k: batch_result.get(k) for k in (
            "study_uid", "bone_type", "bone_confidence", "router_probability",
            "router_bone_label", "router_bone_probabilities", "requested_bone_override",
            "selected_bone", "routing_source", "router_runs", "model_used",
        )},
        "study_uid":      study_uid,
        "selected_index": selected_index,
        "patient_id":     patient_id,
        "output": {
            "filename":    sel["xray"].filename,
            "xray_id":     sel["xray"].id,
            "analysis_id": analysis.id,
            "image_path":  _to_web_path(sel["image_rel"]),
            "gradcam_path": _to_web_path(gradcam_rel),
        },
        "summary": batch_result.get("summary", {}),
        "results": saved_results,
    }


# ═══════════════════════════════════════════════════════════
# ANALYZE-BATCH-TEMP  (new-patient flow: analyse → show form → save)
# ═══════════════════════════════════════════════════════════

@app.post("/api/analyze-batch-temp")
async def analyze_batch_temp(
    files:               List[UploadFile] = File(...),
    file_relative_paths: List[str]        = Form(None),
    bone_type:           Optional[str]    = Form(None),
    doctor: Doctor = Depends(get_current_doctor),
):
    """
    Run inference WITHOUT saving to the database.
    Results are stored server-side in a temp folder keyed by a UUID.
    The UUID (study_uid) is returned to the frontend so it can be passed
    back when the doctor submits the patient form.

    FIX: The original code hex-encoded every raw image and sent it back in
    the JSON response body.  For a study with 20 × 2 MB images that produced
    an ~80 MB response. Now the bytes are saved to disk under
    uploads/temp/<study_uid>/ and only the study_uid is returned.
    """
    _require_approved(doctor)

    if not files:
        raise HTTPException(400, "No files uploaded")

    relative_paths = file_relative_paths or []
    batch_inputs: List[Dict[str, Any]] = []

    for idx, upload in enumerate(files):
        img_bytes = await upload.read()
        if not img_bytes:
            continue
        display_name = (
            relative_paths[idx]
            if idx < len(relative_paths) and relative_paths[idx]
            else upload.filename
        )
        batch_inputs.append({"filename": display_name or "image.jpg", "bytes": img_bytes})

    if not batch_inputs:
        raise HTTPException(400, "Uploaded files were empty")

    try:
        inferred_bone = normalize_bone_type(bone_type) or infer_bone_type_from_text(
            *(e["filename"] for e in batch_inputs)
        )
        batch_result = predict_batch(batch_inputs, bone_override=inferred_bone)
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))

    if "error" in batch_result:
        raise HTTPException(400, batch_result["error"])

    study_uid      = str(uuid.uuid4())
    model_rows     = batch_result.get("results", [])
    study_summary  = batch_result.get("summary", {})
    selected_index = int(batch_result.get("selected_index", 0))
    if not (0 <= selected_index < len(model_rows)):
        selected_index = 0

    # ── Persist raw bytes + gradcam to a temp folder ──────────────────────
    # This avoids sending large binary payloads over the wire.
    temp_folder = f"uploads/temp/{study_uid}"
    os.makedirs(temp_folder, exist_ok=True)

    saved_results: List[Dict[str, Any]] = []
    for idx, (row_input, result) in enumerate(zip(batch_inputs, model_rows)):
        clean_name = _sanitize_filename(row_input["filename"])
        safe_name  = f"{idx:04d}_{clean_name}"
        img_path   = f"{temp_folder}/{safe_name}"
        with open(img_path, "wb") as fh:
            fh.write(row_input["bytes"])

        gradcam_path = ""
        if idx == selected_index and result.get("gradcam_png"):
            gname        = f"gradcam_{os.path.splitext(safe_name)[0]}.png"
            gradcam_path = f"{temp_folder}/{gname}"
            with open(gradcam_path, "wb") as fh:
                fh.write(result["gradcam_png"])

        saved_results.append({
            **{k: v for k, v in result.items() if k != "gradcam_png"},
            "filename":    row_input["filename"],
            "safe_name":   safe_name,
            "img_path":    img_path,
            "gradcam_path": gradcam_path,
        })

    return {
        "study_uid":      study_uid,
        "bone_type":      batch_result.get("bone_type"),
        "bone_confidence": batch_result.get("bone_confidence"),
        "router_probability": batch_result.get("router_probability"),
        "router_bone_label":  batch_result.get("router_bone_label"),
        "router_bone_probabilities": batch_result.get("router_bone_probabilities"),
        "requested_bone_override":   batch_result.get("requested_bone_override"),
        "selected_bone":   batch_result.get("selected_bone"),
        "routing_source":  batch_result.get("routing_source"),
        "router_runs":     batch_result.get("router_runs", 1),
        "model_used":      batch_result.get("model_used"),
        "selected_index":  selected_index,
        "summary":         batch_result.get("summary", {}),
        "results":         saved_results,
        "has_gradcam":     bool(saved_results[selected_index]["gradcam_path"]) if saved_results else False,
        # ← No more file_bytes field — bytes live on disk under temp_folder
    }


# ═══════════════════════════════════════════════════════════
# ANALYZE-FOLDER  (batch with auto patient creation)
# ═══════════════════════════════════════════════════════════

@app.post("/api/analyze-folder")
async def analyze_folder(
    files:               List[UploadFile] = File(...),
    patient_name:        Optional[str]    = Form(None),
    file_relative_paths: List[str]        = Form(None),
    bone_type:           Optional[str]    = Form(None),
    doctor: Doctor = Depends(get_current_doctor),
):
    _require_approved(doctor)

    if not files:
        raise HTTPException(400, "No files uploaded")
    if not patient_name:
        raise HTTPException(400, "Patient name (folder name) is required")

    db      = SessionLocal()
    patient = db.query(Patient).filter(
        Patient.doctor_id == doctor.id,
        Patient.full_name == patient_name,
    ).first()
    if not patient:
        patient = Patient(doctor_id=doctor.id, full_name=patient_name)
        db.add(patient)
        db.commit()
        db.refresh(patient)

    patient_id     = patient.id
    patient_folder = f"uploads/patient_{patient_id}"
    os.makedirs(patient_folder, exist_ok=True)
    db.close()

    relative_paths = file_relative_paths or []
    batch_inputs: List[Dict[str, Any]] = []

    for idx, upload in enumerate(files):
        img_bytes = await upload.read()
        if not img_bytes:
            continue
        display_name = (
            relative_paths[idx]
            if idx < len(relative_paths) and relative_paths[idx]
            else upload.filename
        )
        batch_inputs.append({"filename": display_name or "image.jpg", "bytes": img_bytes})

    if not batch_inputs:
        raise HTTPException(400, "Uploaded files were empty")

    try:
        inferred_bone = normalize_bone_type(bone_type) or infer_bone_type_from_text(
            patient_name, *(e["filename"] for e in batch_inputs)
        )
        batch_result = predict_batch(batch_inputs, bone_override=inferred_bone)
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))

    if "error" in batch_result:
        raise HTTPException(400, batch_result["error"])

    model_rows    = batch_result.get("results", [])
    study_uid     = str(uuid.uuid4())
    study_summary = batch_result.get("summary", {})
    study_fracture    = bool(study_summary.get("fracture_detected", False))
    study_confidence  = float(study_summary.get("study_confidence", 0.0))
    study_probability = float(study_summary.get("study_probability", 0.0))
    study_threshold   = float(study_summary.get("threshold", 0.5))

    saved_results: List[Dict[str, Any]] = []
    xray_rows:     List[Dict[str, Any]] = []

    db = SessionLocal()
    # Re-uploading the same folder replaces the prior study
    db.query(Analysis).filter(Analysis.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Xray).filter(Xray.patient_id == patient_id).delete(synchronize_session=False)

    for idx, (row_input, result) in enumerate(zip(batch_inputs, model_rows)):
        clean_name = _sanitize_filename(row_input["filename"])
        safe_name  = f"{uuid.uuid4()}_{clean_name}"
        image_rel  = f"{patient_folder}/{safe_name}"
        with open(image_rel, "wb") as fh:
            fh.write(row_input["bytes"])

        xray = Xray(
            patient_id      = patient_id,
            filename        = row_input["filename"],
            file_path       = image_rel,
            bone_type       = batch_result.get("bone_type") or result.get("bone_type", "unknown"),
            study_uid       = study_uid,
            gradcam_path    = "",
            fracture        = study_fracture,
            confidence      = study_confidence,
            model_used      = batch_result.get("model_used", result.get("model_used", "specialist")),
            attention_score = float(result.get("attention_score", 0.0)),
        )
        db.add(xray)
        db.flush()
        xray_rows.append({"xray": xray, "result": result, "safe_name": safe_name, "image_rel": image_rel})

    selected_index = int(batch_result.get("selected_index", 0))
    if not (0 <= selected_index < len(xray_rows)):
        selected_index = 0

    sel         = xray_rows[selected_index]
    gradcam_rel = ""
    if sel["result"].get("gradcam_png"):
        gname       = f"gradcam_{os.path.splitext(sel['safe_name'])[0]}.png"
        gradcam_rel = f"{patient_folder}/{gname}"
        with open(gradcam_rel, "wb") as fh:
            fh.write(sel["result"]["gradcam_png"])
        sel["xray"].gradcam_path = gradcam_rel

    analysis = Analysis(
        xray_id           = sel["xray"].id,
        patient_id        = patient_id,
        bone_type         = batch_result.get("bone_type") or sel["result"].get("bone_type", "unknown"),
        probability       = study_probability,
        fracture          = study_fracture,
        confidence        = study_confidence,
        threshold         = study_threshold,
        study_uid         = study_uid,
        gradcam_path      = gradcam_rel,
        router_probability = float(batch_result.get("router_probability", 0.0)),
        bone_confidence   = float(batch_result.get("bone_confidence", 0.0)),
        model_used        = batch_result.get("model_used", "specialist"),
    )
    db.add(analysis)
    db.flush()

    for idx, row in enumerate(xray_rows):
        result = row["result"]
        saved_results.append({
            **{k: v for k, v in result.items() if k != "gradcam_png"},
            "filename":    row["xray"].filename,
            "xray_id":     row["xray"].id,
            "analysis_id": analysis.id,
            "study_uid":   study_uid,
            "image_path":  _to_web_path(row["image_rel"]),
            "gradcam_path": _to_web_path(gradcam_rel) if idx == selected_index else "",
        })

    db.commit()
    db.close()

    return {
        **{k: batch_result.get(k) for k in (
            "bone_type", "bone_confidence", "router_probability", "router_bone_label",
            "router_bone_probabilities", "requested_bone_override", "selected_bone",
            "routing_source", "router_runs", "model_used",
        )},
        "study_uid":      study_uid,
        "selected_index": selected_index,
        "patient_id":     patient_id,
        "patient_name":   patient_name,
        "output": {
            "filename":    sel["xray"].filename,
            "xray_id":     sel["xray"].id,
            "analysis_id": analysis.id,
            "image_path":  _to_web_path(sel["image_rel"]),
            "gradcam_path": _to_web_path(gradcam_rel),
        },
        "summary": batch_result.get("summary", {}),
        "results": saved_results,
    }


# ═══════════════════════════════════════════════════════════
# SAVE-ANALYSIS  (finalize temp analysis after patient creation)
# ═══════════════════════════════════════════════════════════

@app.post("/api/patients/{patient_id}/save-analysis")
async def save_analysis(
    patient_id:    int,
    analysis_data: Dict[str, Any] = Body(...),
    doctor: Doctor = Depends(get_current_doctor),
):
    """
    Move a temporary analysis (produced by /api/analyze-batch-temp) into the
    database once the doctor has filled in the patient form.

    FIX: Instead of re-decoding hex bytes from the JSON body (old ~80 MB payload),
    we now read the files that were saved to uploads/temp/<study_uid>/ on disk.
    """
    _require_approved(doctor)

    db      = SessionLocal()
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.doctor_id == doctor.id,
    ).first()
    if not patient:
        db.close()
        raise HTTPException(404, "Patient not found")

    study_uid          = analysis_data.get("study_uid", "")
    bone_type          = analysis_data.get("bone_type", "unknown")
    fracture           = analysis_data.get("fracture", False)
    confidence         = float(analysis_data.get("confidence", 0.0))
    model_used         = analysis_data.get("model_used", "specialist")
    probability        = float(analysis_data.get("probability", 0.0))
    threshold          = float(analysis_data.get("threshold", 0.5))
    router_probability = float(analysis_data.get("router_probability", 0.0))
    bone_confidence    = float(analysis_data.get("bone_confidence", 0.0))
    selected_index     = int(analysis_data.get("selected_index", 0))
    results            = analysis_data.get("results", [])

    if not study_uid:
        db.close()
        raise HTTPException(400, "study_uid is required")

    temp_folder    = f"uploads/temp/{study_uid}"
    patient_folder = f"uploads/patient_{patient_id}"
    os.makedirs(patient_folder, exist_ok=True)

    if not os.path.isdir(temp_folder):
        db.close()
        raise HTTPException(404, f"Temporary study not found: {study_uid}. It may have expired.")

    # Clear prior analyses for this patient
    db.query(Analysis).filter(Analysis.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Xray).filter(Xray.patient_id == patient_id).delete(synchronize_session=False)

    xray_rows: List[Dict[str, Any]] = []

    for idx, result in enumerate(results):
        src_img = result.get("img_path", "")
        if not src_img or not os.path.isfile(src_img):
            continue

        filename   = result.get("filename", "image.jpg")
        clean_name = _sanitize_filename(filename)
        safe_name  = f"{uuid.uuid4()}_{clean_name}"
        dst_img    = f"{patient_folder}/{safe_name}"
        os.rename(src_img, dst_img)

        xray = Xray(
            patient_id      = patient_id,
            filename        = filename,
            file_path       = dst_img,
            bone_type       = bone_type,
            study_uid       = study_uid,
            fracture        = fracture,
            confidence      = confidence,
            model_used      = model_used,
            attention_score = float(result.get("attention_score", 0.0)),
        )
        db.add(xray)
        db.flush()
        xray_rows.append({
            "xray":     xray,
            "result":   result,
            "safe_name": safe_name,
            "image_rel": dst_img,
        })

    if not xray_rows:
        db.close()
        raise HTTPException(400, "No valid temp files were found for this study.")

    selected_index = max(0, min(selected_index, len(xray_rows) - 1))
    sel            = xray_rows[selected_index]
    gradcam_rel    = ""

    src_cam = results[selected_index].get("gradcam_path", "") if selected_index < len(results) else ""
    if src_cam and os.path.isfile(src_cam):
        gname       = f"gradcam_{os.path.splitext(sel['safe_name'])[0]}.png"
        gradcam_rel = f"{patient_folder}/{gname}"
        os.rename(src_cam, gradcam_rel)
        sel["xray"].gradcam_path = gradcam_rel

    analysis = Analysis(
        xray_id           = sel["xray"].id,
        patient_id        = patient_id,
        bone_type         = bone_type,
        probability       = probability,
        fracture          = fracture,
        confidence        = confidence,
        threshold         = threshold,
        study_uid         = study_uid,
        gradcam_path      = gradcam_rel,
        router_probability = router_probability,
        bone_confidence   = bone_confidence,
        model_used        = model_used,
    )
    db.add(analysis)
    db.flush()

    saved_results: List[Dict[str, Any]] = []
    for idx, row in enumerate(xray_rows):
        result = row["result"]
        saved_results.append({
            **{k: v for k, v in result.items() if k not in ("gradcam_png", "img_path", "safe_name", "gradcam_path")},
            "filename":    row["xray"].filename,
            "xray_id":     row["xray"].id,
            "analysis_id": analysis.id,
            "study_uid":   study_uid,
            "image_path":  _to_web_path(row["image_rel"]),
            "gradcam_path": _to_web_path(gradcam_rel) if idx == selected_index else "",
        })

    db.commit()
    db.close()

    # Clean up whatever is left in the temp folder
    try:
        import shutil
        shutil.rmtree(temp_folder, ignore_errors=True)
    except Exception:
        pass

    return {
        "study_uid":   study_uid,
        "bone_type":   bone_type,
        "patient_id":  patient_id,
        "analysis_id": analysis.id,
        "results":     saved_results,
    }


# ═══════════════════════════════════════════════════════════
# HISTORY
# ═══════════════════════════════════════════════════════════

@app.get("/api/history")
def get_history(
    limit: int = 50,
    doctor: Doctor = Depends(get_current_doctor),
):
    _require_approved(doctor)
    db      = SessionLocal()
    pid_sub = db.query(Patient.id).filter(Patient.doctor_id == doctor.id).subquery()
    rows    = (
        db.query(Analysis)
        .filter(Analysis.patient_id.in_(pid_sub))
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .all()
    )
    history = []
    for a in rows:
        xray    = db.query(Xray).filter(Xray.id == a.xray_id).first()
        patient = db.query(Patient).filter(Patient.id == a.patient_id).first()
        study_image_count = (
            db.query(Xray)
            .filter(Xray.patient_id == a.patient_id, Xray.study_uid == a.study_uid)
            .count()
            if a.study_uid else 1
        )
        history.append({
            "analysis_id":        a.id,
            "xray_id":            a.xray_id,
            "patient_id":         a.patient_id,
            "patient_name":       patient.full_name if patient else "",
            "filename":           xray.filename   if xray    else "",
            "image_path":         _to_web_path(xray.file_path if xray else ""),
            "gradcam_path":       _to_web_path(a.gradcam_path or (xray.gradcam_path if xray else "")),
            "study_uid":          a.study_uid,
            "study_images_count": study_image_count,
            "bone_type":          a.bone_type,
            "fracture":           a.fracture,
            "confidence":         a.confidence,
            "probability":        a.probability,
            "bone_confidence":    a.bone_confidence,
            "model_used":         a.model_used,
            "created_at":         a.created_at.isoformat(),
        })
    db.close()
    return history


# ═══════════════════════════════════════════════════════════
# ADMIN
# ═══════════════════════════════════════════════════════════

@app.get("/api/admin/doctors")
def list_all_doctors(doctor: Doctor = Depends(get_current_doctor)):
    _require_admin(doctor)
    db   = SessionLocal()
    rows = db.query(Doctor).order_by(Doctor.created_at.desc()).all()
    db.close()
    return [{**_doctor_to_dict(r), "created_at": r.created_at.isoformat()} for r in rows]


@app.patch("/api/admin/approve")
def approve_doctor(
    doctor_id: int  = Form(...),
    approved:  bool = Form(...),
    current: Doctor = Depends(get_current_doctor),
):
    _require_admin(current)
    db  = SessionLocal()
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        db.close()
        raise HTTPException(404, "Doctor not found")

    if approved:
        doc.approved = True
        db.commit()
        db.close()
        return {"updated": True, "doctor_id": doctor_id, "approved": True, "deleted": False}

    # Delete doctor: remove their analyses and X-rays; patients stay (orphaned)
    patient_ids = [p.id for p in db.query(Patient).filter(Patient.doctor_id == doctor_id).all()]
    if patient_ids:
        db.query(Analysis).filter(Analysis.patient_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(Xray).filter(Xray.patient_id.in_(patient_ids)).delete(synchronize_session=False)
    db.delete(doc)
    db.commit()
    db.close()
    return {"updated": True, "doctor_id": doctor_id, "approved": False, "deleted": True}


@app.get("/api/admin/analyses")
def all_analyses(current: Doctor = Depends(get_current_doctor)):
    _require_admin(current)
    db   = SessionLocal()
    rows = db.query(Analysis).order_by(Analysis.created_at.desc()).limit(200).all()
    result = []
    for a in rows:
        patient = db.query(Patient).filter(Patient.id == a.patient_id).first()
        doc_row = db.query(Doctor).filter(Doctor.id == patient.doctor_id).first() if patient else None
        result.append({
            "analysis_id":  a.id,
            "patient_name": patient.full_name if patient else "",
            "doctor_name":  doc_row.full_name if doc_row else "",
            "bone_type":    a.bone_type,
            "fracture":     a.fracture,
            "confidence":   a.confidence,
            "created_at":   a.created_at.isoformat(),
        })
    db.close()
    return result


@app.get("/api/admin/patients")
def all_patients(current: Doctor = Depends(get_current_doctor)):
    _require_admin(current)
    db   = SessionLocal()
    rows = db.query(Patient).order_by(Patient.created_at.desc()).all()
    result = []
    for p in rows:
        doc_row        = db.query(Doctor).filter(Doctor.id == p.doctor_id).first()
        xray_count     = db.query(Xray).filter(Xray.patient_id == p.id).count()
        analysis_count = db.query(Analysis).filter(Analysis.patient_id == p.id).count()
        result.append({
            **_patient_dict(p),
            "doctor_name":   doc_row.full_name if doc_row else "Unknown Doctor",
            "xray_count":    xray_count,
            "analysis_count": analysis_count,
        })
    db.close()
    return result


# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

def _require_approved(doctor: Doctor):
    if not doctor.approved and doctor.role != "admin":
        raise HTTPException(403, "Account not yet approved by admin")


def _require_admin(doctor: Doctor):
    if doctor.role != "admin":
        raise HTTPException(403, "Admin access required")


def _sanitize_filename(filename: str) -> str:
    base  = os.path.basename(filename or "image.jpg")
    clean = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return clean or "image.jpg"


def _to_web_path(path: str) -> str:
    if not path:
        return ""
    normalized = path.replace("\\", "/").lstrip("/")
    return "/" + normalized


def _patient_dict(p: Patient) -> Dict[str, Any]:
    return {
        "id":            p.id,
        "full_name":     p.full_name,
        "date_of_birth": p.date_of_birth,
        "gender":        p.gender,
        "phone":         p.phone,
        "notes":         p.notes,
        "created_at":    p.created_at.isoformat(),
    }


def _xray_dict(x: Xray) -> Dict[str, Any]:
    return {
        "id":               x.id,
        "filename":         x.filename,
        "file_path":        _to_web_path(x.file_path),
        "bone_type":        x.bone_type,
        "study_uid":        getattr(x, "study_uid", ""),
        "gradcam_path":     _to_web_path(getattr(x, "gradcam_path", "") or ""),
        "fracture":         getattr(x, "fracture", False),
        "confidence":       getattr(x, "confidence", 0.0),
        "attention_score":  getattr(x, "attention_score", 0.0),
        "model_used":       getattr(x, "model_used", "specialist"),
        "uploaded_at":      x.uploaded_at.isoformat(),
    }


def _analysis_dict(a: Analysis) -> Dict[str, Any]:
    return {
        "id":                 a.id,
        "xray_id":            a.xray_id,
        "bone_type":          a.bone_type,
        "study_uid":          getattr(a, "study_uid", ""),
        "gradcam_path":       _to_web_path(a.gradcam_path),
        "fracture":           a.fracture,
        "confidence":         a.confidence,
        "probability":        a.probability,
        "bone_confidence":    a.bone_confidence,
        "router_probability": getattr(a, "router_probability", 0.0),
        "threshold":          getattr(a, "threshold", 0.5),
        "model_used":         a.model_used,
        "created_at":         a.created_at.isoformat(),
    }