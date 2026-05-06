import hashlib
import os
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
import torchvision.transforms as T

BONE_TYPES = [
    "XR_ELBOW",
    "XR_FINGER",
    "XR_FOREARM",
    "XR_HAND",
    "XR_HUMERUS",
    "XR_SHOULDER",
    "XR_WRIST",
]
NUM_BONE_CLASSES = len(BONE_TYPES)

BONE_LABEL_MAP = {
    "XR_ELBOW":    "elbow",
    "XR_FINGER":   "finger",
    "XR_FOREARM":  "forearm",
    "XR_HAND":     "hand",
    "XR_HUMERUS":  "humerus",
    "XR_SHOULDER": "shoulder",
    "XR_WRIST":    "wrist",
}

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKPOINT_DIR = os.path.join(BASE_DIR, "checkpoints")


# ═══════════════════════════════════════════════════════════
# MODEL ARCHITECTURES
# ═══════════════════════════════════════════════════════════

class MultiTaskAttentionMIL(nn.Module):
    def __init__(self, num_bone_classes: int):
        super().__init__()
        backbone = models.mobilenet_v2(weights=None)
        self.feature_extractor = backbone.features
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.feat_dim = 1280
        self.dropout = nn.Dropout(0.3)
        self.attention = nn.Sequential(
            nn.Linear(self.feat_dim, 256),
            nn.Tanh(),
            nn.Linear(256, 1),
        )
        self.classifier_abnormal = nn.Linear(self.feat_dim, 1)
        self.classifier_bone = nn.Sequential(
            nn.Linear(self.feat_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, num_bone_classes),
        )

    def forward(self, x: torch.Tensor):
        x = x.squeeze(0)
        feats = self.pool(self.feature_extractor(x)).view(x.size(0), -1)
        attention = torch.softmax(self.attention(feats), dim=0)
        bag = self.dropout(torch.sum(attention * feats, dim=0))
        return self.classifier_abnormal(bag), self.classifier_bone(bag), attention


class AttentionMIL(nn.Module):
    def __init__(self, backbone: str = "mobilenetv2"):
        super().__init__()
        self.backbone_name = backbone
        if backbone == "resnet50":
            base = models.resnet50(weights=None)
            # FIX: Exclude avgpool AND fc so we keep spatial feature maps for Grad-CAM.
            # Previously included avgpool which collapsed to 1x1, killing spatial info.
            self.feature_extractor = nn.Sequential(*list(base.children())[:-2])  # up to layer4
            self.feat_dim = 2048
            self._use_pool = True  # FIX: now we always pool ourselves
        else:
            base = models.mobilenet_v2(weights=None)
            self.feature_extractor = base.features
            self.feat_dim = 1280
            self._use_pool = True

        self.pool = nn.AdaptiveAvgPool2d(1)
        self.dropout = nn.Dropout(0.3)
        self.attention = nn.Sequential(
            nn.Linear(self.feat_dim, 256),
            nn.Tanh(),
            nn.Linear(256, 1),
        )
        self.classifier = nn.Linear(self.feat_dim, 1)

    def forward(self, x: torch.Tensor):
        x = x.squeeze(0)
        out = self.feature_extractor(x)
        out = self.pool(out)
        feats = out.view(x.size(0), -1)
        attention = torch.softmax(self.attention(feats), dim=0)
        bag = self.dropout((attention * feats).sum(0))
        return self.classifier(bag), attention


# ═══════════════════════════════════════════════════════════
# CHECKPOINT REGISTRY
# ═══════════════════════════════════════════════════════════

MODEL_REGISTRY = {
    "shoulder": {"ckpt": "shoulder_best.pth", "threshold": 0.5, "backbone": "mobilenetv2"},
    "wrist":    {"ckpt": "wrist_best.pth",    "threshold": 0.5, "backbone": "resnet50"},
    "elbow":    {"ckpt": "elbow_best.pth",    "threshold": 0.5, "backbone": "mobilenetv2"},
    "finger":   {"ckpt": "finger_best.pth",   "threshold": 0.5, "backbone": "mobilenetv2"},
    "forearm":  {"ckpt": "forearm_best.pth",  "threshold": 0.5, "backbone": "mobilenetv2"},
    "hand":     {"ckpt": "hand_best.pth",     "threshold": 0.5, "backbone": "mobilenetv2"},
    "humerus":  {"ckpt": "humerus_best.pth",  "threshold": 0.5, "backbone": "mobilenetv2"},
}

BONE_ALIASES = {
    **{key: key for key in MODEL_REGISTRY.keys()},
    **{f"xr_{key}": key for key in MODEL_REGISTRY.keys()},
    **{f"xr-{key}": key for key in MODEL_REGISTRY.keys()},
    "xr_shoulder": "shoulder",
    "xr_wrist":    "wrist",
    "xr_elbow":    "elbow",
    "xr_finger":   "finger",
    "xr_forearm":  "forearm",
    "xr_hand":     "hand",
    "xr_humerus":  "humerus",
}

_general_model: Optional[MultiTaskAttentionMIL] = None
_specialist_cache: Dict[str, AttentionMIL] = {}


# ═══════════════════════════════════════════════════════════
# BONE-TYPE HELPERS
# ═══════════════════════════════════════════════════════════

def normalize_bone_type(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().lower().replace(" ", "_").replace("-", "_")
    return BONE_ALIASES.get(normalized)


def infer_bone_type_from_text(*values: Optional[str]) -> Optional[str]:
    text = " ".join(v or "" for v in values).lower().replace("-", "_")
    for alias, bone_type in sorted(BONE_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if alias and alias in text:
            return bone_type
    return None


# ═══════════════════════════════════════════════════════════
# CHECKPOINT PATH RESOLUTION
# ═══════════════════════════════════════════════════════════

def _checkpoint_path(filename_or_path: str) -> str:
    if os.path.isabs(filename_or_path):
        return filename_or_path
    if os.path.dirname(filename_or_path):
        return os.path.join(BASE_DIR, filename_or_path)
    return os.path.join(CHECKPOINT_DIR, filename_or_path)


def _short_sha256(path: str) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()[:12]


# ═══════════════════════════════════════════════════════════
# STATE-DICT EXTRACTION & KEY MATCHING
# ═══════════════════════════════════════════════════════════

def _is_tensor_state_dict(candidate: Any) -> bool:
    return (
        isinstance(candidate, dict)
        and bool(candidate)
        and all(torch.is_tensor(v) for v in candidate.values())
    )


def _extract_state_dict(raw_checkpoint: Any) -> Dict[str, torch.Tensor]:
    if _is_tensor_state_dict(raw_checkpoint):
        return raw_checkpoint

    if isinstance(raw_checkpoint, dict):
        preferred_keys = (
            "model_state_dict",
            "state_dict",
            "model",
            "net",
            "weights",
            "ema_state_dict",
        )
        for key in preferred_keys:
            maybe_state = raw_checkpoint.get(key)
            if _is_tensor_state_dict(maybe_state):
                return maybe_state

        best_nested: Optional[Dict[str, Any]] = None
        best_score = 0
        for value in raw_checkpoint.values():
            if isinstance(value, dict) and value:
                score = sum(1 for v in value.values() if torch.is_tensor(v))
                if score > best_score:
                    best_score = score
                    best_nested = value

        if best_nested:
            tensor_only = {k: v for k, v in best_nested.items() if torch.is_tensor(v)}
            if tensor_only:
                return tensor_only

    raise RuntimeError("Checkpoint format is not supported (state_dict not found).")


def _generate_state_variants(
    state_dict: Dict[str, torch.Tensor],
) -> List[Dict[str, torch.Tensor]]:
    variants: List[Dict[str, torch.Tensor]] = []
    seen_signatures: set = set()

    def register(candidate: Dict[str, torch.Tensor]) -> bool:
        signature = tuple(sorted(candidate.keys()))
        if signature in seen_signatures:
            return False
        seen_signatures.add(signature)
        variants.append(candidate)
        return True

    queue: List[Dict[str, torch.Tensor]] = [state_dict]
    register(state_dict)

    prefixes = ("module.", "model.", "net.", "network.", "_orig_mod.")
    replacements = (
        ("feature_extractor.features.", "feature_extractor."),
        ("backbone.features.",          "feature_extractor."),
        ("features.",                   "feature_extractor."),
    )

    while queue:
        current = queue.pop(0)
        total = len(current)
        if total == 0:
            continue

        for prefix in prefixes:
            starts = sum(1 for key in current.keys() if key.startswith(prefix))
            if starts >= max(1, int(0.7 * total)):
                stripped = {
                    (key[len(prefix):] if key.startswith(prefix) else key): value
                    for key, value in current.items()
                }
                if register(stripped):
                    queue.append(stripped)

        for src, dst in replacements:
            if any(key.startswith(src) for key in current.keys()):
                remapped = {
                    (dst + key[len(src):] if key.startswith(src) else key): value
                    for key, value in current.items()
                }
                if register(remapped):
                    queue.append(remapped)

    return variants


def _pick_best_state_variant(
    model: nn.Module,
    state_dict: Dict[str, torch.Tensor],
) -> Tuple[Dict[str, torch.Tensor], int, int]:
    expected = set(model.state_dict().keys())
    best_state = state_dict
    best_overlap = -1

    for candidate in _generate_state_variants(state_dict):
        overlap = sum(1 for key in candidate.keys() if key in expected)
        if overlap > best_overlap:
            best_overlap = overlap
            best_state = candidate

    return best_state, best_overlap, len(expected)


def _load_checkpoint_weights(model: nn.Module, checkpoint_path: str, model_name: str) -> None:
    raw = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    extracted = _extract_state_dict(raw)
    state_dict, overlap, expected_count = _pick_best_state_variant(model, extracted)

    if overlap <= 0:
        sample = ", ".join(list(extracted.keys())[:5])
        raise RuntimeError(
            f"{model_name} checkpoint is incompatible (no matching keys). "
            f"Sample checkpoint keys: {sample or 'none'}"
        )

    try:
        model.load_state_dict(state_dict, strict=True)
        return
    except RuntimeError:
        pass

    incompatible = model.load_state_dict(state_dict, strict=False)
    loaded_count = expected_count - len(incompatible.missing_keys)
    coverage = loaded_count / max(1, expected_count)

    critical_prefixes = ("attention.", "classifier.", "classifier_abnormal.", "classifier_bone.")
    missing_critical = [
        key for key in incompatible.missing_keys
        if key.startswith(critical_prefixes)
    ]

    if coverage < 0.9 or missing_critical or incompatible.unexpected_keys:
        missing_preview    = ", ".join(incompatible.missing_keys[:8])
        unexpected_preview = ", ".join(incompatible.unexpected_keys[:8])
        raise RuntimeError(
            f"{model_name} checkpoint partially loaded ({loaded_count}/{expected_count} tensors). "
            f"Missing keys sample: {missing_preview or 'none'}. "
            f"Unexpected keys sample: {unexpected_preview or 'none'}"
        )


# ═══════════════════════════════════════════════════════════
# MODEL GETTERS  (cached singletons)
# ═══════════════════════════════════════════════════════════

def get_general_model() -> MultiTaskAttentionMIL:
    global _general_model
    if _general_model is not None:
        return _general_model

    general_ckpt = _checkpoint_path("general_best.pth")
    if not os.path.exists(general_ckpt):
        raise RuntimeError(
            f"General model checkpoint not found: {general_ckpt}. "
            "Place general_best.pth inside the 'checkpoints/' folder next to predictor.py."
        )

    model = MultiTaskAttentionMIL(num_bone_classes=NUM_BONE_CLASSES).to(DEVICE)
    _load_checkpoint_weights(model, general_ckpt, "General model")
    model.eval()
    _general_model = model
    return model


def get_specialist(bone_type: str) -> AttentionMIL:
    if bone_type in _specialist_cache:
        return _specialist_cache[bone_type]

    if bone_type not in MODEL_REGISTRY:
        raise RuntimeError(f"Specialist model not registered for bone: {bone_type}")

    specialist_ckpt = _checkpoint_path(MODEL_REGISTRY[bone_type]["ckpt"])
    if not os.path.exists(specialist_ckpt):
        raise RuntimeError(
            f"Specialist checkpoint not found: {specialist_ckpt}. "
            f"Place {MODEL_REGISTRY[bone_type]['ckpt']} inside the 'checkpoints/' folder."
        )

    backbone = MODEL_REGISTRY[bone_type].get("backbone", "mobilenetv2")
    model = AttentionMIL(backbone=backbone).to(DEVICE)
    _load_checkpoint_weights(model, specialist_ckpt, f"{bone_type} specialist")
    model.eval()
    _specialist_cache[bone_type] = model
    return model


# ═══════════════════════════════════════════════════════════
# CHECKPOINT VALIDATION
# ═══════════════════════════════════════════════════════════

def validate_checkpoints() -> Dict[str, Dict[str, Any]]:
    registry = {
        "general": {"ckpt": _checkpoint_path("general_best.pth"), "kind": "general"},
        **{
            bone: {
                "ckpt": _checkpoint_path(cfg["ckpt"]),
                "kind": "specialist",
                "backbone": cfg.get("backbone", "mobilenetv2"),
            }
            for bone, cfg in MODEL_REGISTRY.items()
        },
    }

    report: Dict[str, Dict[str, Any]] = {}
    for name, cfg in registry.items():
        ckpt = cfg["ckpt"]
        entry: Dict[str, Any] = {
            "checkpoint": ckpt,
            "exists": os.path.exists(ckpt),
            "device": str(DEVICE),
            "bone_classes": BONE_TYPES if name == "general" else None,
        }
        if not entry["exists"]:
            entry["status"] = "missing"
            report[name] = entry
            continue

        try:
            if cfg["kind"] == "general":
                model: nn.Module = MultiTaskAttentionMIL(num_bone_classes=NUM_BONE_CLASSES).to(DEVICE)
            else:
                model = AttentionMIL(backbone=cfg.get("backbone", "mobilenetv2")).to(DEVICE)

            raw = torch.load(ckpt, map_location=DEVICE, weights_only=False)
            extracted = _extract_state_dict(raw)
            chosen_state, overlap, expected_count = _pick_best_state_variant(model, extracted)

            try:
                model.load_state_dict(chosen_state, strict=True)
                strict_ok = True
            except RuntimeError:
                incompatible = model.load_state_dict(chosen_state, strict=False)
                strict_ok = False
                loaded = expected_count - len(incompatible.missing_keys)
                coverage = loaded / max(1, expected_count)
                if coverage < 0.9:
                    raise RuntimeError(
                        f"Only {loaded}/{expected_count} tensors matched — checkpoint may be wrong model."
                    )

            entry.update({
                "status":           "ok",
                "sha256_12":        _short_sha256(ckpt),
                "checkpoint_keys":  list(raw.keys()) if isinstance(raw, dict) and not _is_tensor_state_dict(raw) else [],
                "best_auc":         raw.get("best_auc") if isinstance(raw, dict) else None,
                "epoch":            raw.get("epoch")    if isinstance(raw, dict) else None,
                "backbone":         cfg.get("backbone", "mobilenetv2") if cfg["kind"] == "specialist" else "mobilenetv2",
                "loaded_tensors":   overlap,
                "expected_tensors": expected_count,
                "strict_key_match": strict_ok,
            })
        except Exception as exc:
            entry.update({"status": "error", "error": str(exc)})

        report[name] = entry

    return report


# ═══════════════════════════════════════════════════════════
# PREPROCESSING
# ═══════════════════════════════════════════════════════════

def preprocess_general(img_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Failed to decode image")
    return cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)


def preprocess_specialist(img_bytes: bytes, bone_type: str) -> np.ndarray:
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Failed to decode image")
    return cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)


VAL_TF = T.Compose([
    T.ToPILImage(),
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def _to_bag_tensor(rgb_images: List[np.ndarray]) -> torch.Tensor:
    if not rgb_images:
        raise ValueError("No images were provided")
    return torch.stack([VAL_TF(rgb) for rgb in rgb_images], dim=0).unsqueeze(0).to(DEVICE)


# ═══════════════════════════════════════════════════════════
# GENERAL ROUTER
# ═══════════════════════════════════════════════════════════

def _run_general_router(img_list: List[bytes]) -> Dict[str, Any]:
    general = get_general_model()
    rgb_images = [preprocess_general(img) for img in img_list]
    bag = _to_bag_tensor(rgb_images)

    with torch.no_grad():
        out_abn, out_bone, attention = general(bag)
        general_prob = float(torch.sigmoid(out_abn).item())
        bone_probs = F.softmax(out_bone, dim=-1).detach().cpu().tolist()
        attn_scores: List[float] = (
            attention.squeeze(-1).detach().cpu().numpy().astype(float).tolist()
            if attention is not None else []
        )

    bone_idx      = int(np.argmax(bone_probs))
    bone_xr_label = BONE_TYPES[bone_idx]
    bone_conf     = float(bone_probs[bone_idx])
    mapped_bone   = BONE_LABEL_MAP.get(bone_xr_label)
    best_idx      = int(np.argmax(attn_scores)) if attn_scores else 0

    bone_probabilities = {
        BONE_LABEL_MAP[label]: round(float(prob) * 100.0, 2)
        for label, prob in zip(BONE_TYPES, bone_probs)
        if BONE_LABEL_MAP.get(label)
    }

    return {
        "router_probability": general_prob,
        "bone_xr_label":      bone_xr_label,
        "bone_confidence":    bone_conf,
        "bone_probabilities": bone_probabilities,
        "mapped_bone":        mapped_bone,
        "attention_scores":   attn_scores,
        "best_idx":           best_idx,
    }


# ═══════════════════════════════════════════════════════════
# GRAD-CAM  (completely rewritten)
# ═══════════════════════════════════════════════════════════

def _get_gradcam_target_layer(model: AttentionMIL) -> nn.Module:
    """
    Return the last spatial conv layer before global pooling.
    - MobileNetV2: last InvertedResidual block in features
    - ResNet50:    layer4 (index 7 in feature_extractor, which is now [:-2] children)
    """
    if model.backbone_name == "resnet50":
        # feature_extractor = Sequential(conv1, bn1, relu, maxpool, layer1, layer2, layer3, layer4)
        # index 7 = layer4, the last spatial conv block with 7x7 spatial output at 224px input
        return model.feature_extractor[7]
    else:
        # MobileNetV2 features: index -1 is the last Conv2dNormActivation block
        return model.feature_extractor[-1]


def _compute_gradcam(
    model: AttentionMIL,
    input_tensor: torch.Tensor,   # [1, C, H, W] — single image
) -> Optional[np.ndarray]:
    """
    Compute Grad-CAM heatmap for a single image.
    Uses the fracture classifier score as the target for backprop.
    Returns a float32 array in [0,1] of shape (224, 224), or None on failure.
    """
    target_layer = _get_gradcam_target_layer(model)

    features:  List[torch.Tensor] = []
    gradients: List[torch.Tensor] = []

    def save_features(_: nn.Module, __: Any, output: torch.Tensor):
        features.append(output)

    def save_gradients(_: nn.Module, __: Any, grad_output: Any):
        gradients.append(grad_output[0])

    h_fwd = target_layer.register_forward_hook(save_features)
    h_bwd = target_layer.register_full_backward_hook(save_gradients)

    try:
        model.eval()
        # Need gradients — clone and enable grad
        inp = input_tensor.clone().requires_grad_(True)

        # Forward: extract spatial features → pool → classify
        feat_out = model.feature_extractor(inp)          # [1, C, H, W]
        pooled   = model.pool(feat_out).view(1, -1)      # [1, feat_dim]
        score    = torch.sigmoid(model.classifier(pooled))  # [1, 1]

        model.zero_grad()
        score.backward()

        if not gradients or not features:
            return None

        grads = gradients[0].detach().cpu().numpy()[0]   # [C, H, W]
        fmaps = features[0].detach().cpu().numpy()[0]    # [C, H, W]

        # Global average pool the gradients → channel weights
        weights = np.mean(grads, axis=(1, 2))            # [C]

        # Weighted combination of feature maps
        cam = np.zeros(fmaps.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * fmaps[i]

        # ReLU + resize to input size
        cam = np.maximum(cam, 0)
        cam = cv2.resize(cam, (224, 224))

        # Normalize to [0, 1]
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max - cam_min < 1e-8:
            return None
        cam = (cam - cam_min) / (cam_max - cam_min)
        return cam.astype(np.float32)

    except Exception:
        return None
    finally:
        h_fwd.remove()
        h_bwd.remove()


def _overlay_cam(
    base_rgb: np.ndarray,
    cam: Optional[np.ndarray],
    force_plain: bool,
) -> Optional[bytes]:
    """
    Overlay a Grad-CAM heatmap on the base RGB image.
    If force_plain=True or cam is None, returns the plain resized image.
    """
    if base_rgb is None:
        return None

    img = cv2.resize(base_rgb, (224, 224)).astype(np.float32)

    if force_plain or cam is None:
        out_bgr = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2BGR)
        ok, encoded = cv2.imencode(".png", out_bgr)
        return bytes(encoded) if ok else None

    # Build heatmap
    cam_uint8   = np.uint8(255 * cam)
    heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_JET)
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)

    # Blend: stronger image, lighter heatmap so anatomy stays visible
    blended = np.clip(0.55 * img + 0.45 * heatmap_rgb, 0, 255).astype(np.uint8)
    out_bgr = cv2.cvtColor(blended, cv2.COLOR_RGB2BGR)
    ok, encoded = cv2.imencode(".png", out_bgr)
    return bytes(encoded) if ok else None


# ═══════════════════════════════════════════════════════════
# SPECIALIST STUDY RUNNER
# ═══════════════════════════════════════════════════════════

def _run_specialist_study(img_list: List[bytes], bone_type: str) -> Dict[str, Any]:
    specialist = get_specialist(bone_type)
    threshold  = float(MODEL_REGISTRY[bone_type]["threshold"])
    rgb_images = [preprocess_specialist(img, bone_type) for img in img_list]
    bag        = _to_bag_tensor(rgb_images)

    with torch.no_grad():
        logits, attention = specialist(bag)
        study_prob  = float(torch.sigmoid(logits).item())
        attn_scores = attention.squeeze(-1).detach().cpu().numpy().astype(float)

    if attn_scores.size == 0:
        attn_scores = np.array([1.0], dtype=np.float32)

    best_idx = int(np.argmax(attn_scores))

    # Re-run the selected image WITH gradients for Grad-CAM
    selected_rgb    = rgb_images[best_idx]
    selected_tensor = VAL_TF(selected_rgb).unsqueeze(0).to(DEVICE)  # [1, C, H, W]

    cam         = _compute_gradcam(specialist, selected_tensor)
    force_plain = study_prob <= threshold   # plain image when normal, heatmap when fracture
    gradcam_png = _overlay_cam(selected_rgb, cam, force_plain=force_plain)

    return {
        "study_probability": study_prob,
        "threshold":         threshold,
        "attention_scores":  attn_scores.tolist(),
        "best_idx":          best_idx,
        "gradcam_png":       gradcam_png,
    }


# ═══════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════

def predict_batch(
    images: List[Dict[str, Any]],
    bone_override: Optional[str] = None,
) -> Dict[str, Any]:
    if not images:
        return {"error": "No images provided"}

    img_bytes_list      = [entry["bytes"] for entry in images]
    router_info         = _run_general_router(img_bytes_list)

    normalized_override = normalize_bone_type(bone_override)
    used_override       = bool(normalized_override)
    selected_bone       = normalized_override if used_override else router_info["mapped_bone"]
    use_specialist      = bool(selected_bone and selected_bone in MODEL_REGISTRY)

    if use_specialist:
        study_info     = _run_specialist_study(img_bytes_list, selected_bone)
        study_prob     = float(study_info["study_probability"])
        threshold      = float(study_info["threshold"])
        best_idx       = int(study_info["best_idx"])
        attn_scores    = study_info["attention_scores"]
        study_fracture = bool(study_prob > threshold)
        gradcam_png    = study_info["gradcam_png"]
        bone_type_val  = selected_bone
        model_used     = "specialist"
    else:
        study_prob     = float(router_info["router_probability"])
        threshold      = 0.5
        best_idx       = int(router_info["best_idx"])
        attn_scores    = router_info["attention_scores"]
        study_fracture = bool(study_prob > threshold)
        best_rgb       = cv2.resize(preprocess_general(img_bytes_list[best_idx]), (224, 224))
        gradcam_png    = _overlay_cam(best_rgb, None, force_plain=not study_fracture)
        bone_type_val  = router_info["bone_xr_label"]
        model_used     = "general"

    confidence      = (study_prob if study_prob > 0.5 else 1.0 - study_prob) * 100.0
    attention_total = float(np.sum(attn_scores)) if attn_scores else 1.0
    if attention_total <= 0:
        attention_total = 1.0

    results: List[Dict[str, Any]] = []
    for idx, entry in enumerate(images):
        raw_attn = float(attn_scores[idx]) if idx < len(attn_scores) else 0.0
        results.append({
            "filename":             entry.get("filename", "image.jpg"),
            "bone_type":            bone_type_val,
            "bone_confidence":      round(router_info["bone_confidence"] * 100.0, 1),
            "probability":          round(study_prob, 4),
            "confidence":           round(confidence, 1),
            "fracture":             study_fracture,
            "threshold":            threshold,
            "model_used":           model_used,
            "attention_score":      round(raw_attn / attention_total, 4),
            "selected_for_gradcam": idx == best_idx,
            "gradcam_png":          gradcam_png if idx == best_idx else None,
        })

    return {
        "bone_type":                 bone_type_val,
        "bone_confidence":           round(router_info["bone_confidence"] * 100.0, 1),
        "router_probability":        round(router_info["router_probability"], 4),
        "router_bone_label":         router_info["bone_xr_label"],
        "router_bone_probabilities": router_info["bone_probabilities"],
        "requested_bone_override":   bone_override,
        "selected_bone":             selected_bone,
        "routing_source":            "manual_override" if used_override else "general_router",
        "router_runs":               1,
        "model_used":                model_used,
        "selected_index":            best_idx,
        "summary": {
            "images_count":        len(results),
            "fracture_count":      1 if study_fracture else 0,
            "normal_count":        0 if study_fracture else 1,
            "fracture_detected":   study_fracture,
            "decision_basis":      "mil_study_probability",
            "threshold":           round(threshold, 4),
            "study_probability":   round(study_prob, 4),
            "study_confidence":    round(confidence, 1),
            "average_probability": round(study_prob, 4),
            "average_confidence":  round(confidence, 1),
        },
        "results": results,
    }


def predict(
    img_bytes: bytes,
    filename: Optional[str] = None,
    bone_override: Optional[str] = None,
) -> Dict[str, Any]:
    batch = predict_batch(
        [{"bytes": img_bytes, "filename": filename or "image.jpg"}],
        bone_override=bone_override,
    )
    if "error" in batch:
        return batch
    return dict(batch["results"][0])