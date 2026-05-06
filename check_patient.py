#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from database import SessionLocal, Doctor, Patient

db = SessionLocal()

print("=== CHECKING DATABASE ===\n")

doctors = db.query(Doctor).all()
print(f"Total Doctors: {len(doctors)}")
for d in doctors:
    print(f"  ID {d.id}: {d.email} ({d.full_name})")

print("\n=== PATIENTS BY DOCTOR ===\n")
patients_all = db.query(Patient).all()
print(f"Total Patients (all): {len(patients_all)}")

for p in patients_all:
    print(f"  ID {p.id}: {p.full_name} (doctor_id={p.doctor_id}, DOB={p.date_of_birth}, gender={p.gender})")

db.close()
print("\nDone.")
