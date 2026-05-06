from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "postgresql://postgres:root@localhost/osseoAI"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    specialty = Column(String, default="")
    hospital = Column(String, default="")
    license_no = Column(String, default="")
    role = Column(String, default="doctor")
    approved = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    doctor_id = Column(Integer, nullable=False)
    full_name = Column(String, nullable=False)
    date_of_birth = Column(String, default="")
    gender = Column(String, default="")
    phone = Column(String, default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Xray(Base):
    __tablename__ = "xrays"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    bone_type = Column(String, default="")
    study_uid = Column(String, default="")
    gradcam_path = Column(String, default="")
    fracture = Column(Boolean, default=False)
    confidence = Column(Float, default=0.0)
    model_used = Column(String, default="specialist")
    attention_score = Column(Float, default=0.0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True)
    xray_id = Column(Integer, nullable=False)
    patient_id = Column(Integer, nullable=False)
    bone_type = Column(String, nullable=False)
    probability = Column(Float, nullable=False)
    fracture = Column(Boolean, nullable=False)
    confidence = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    study_uid = Column(String, default="")
    gradcam_path = Column(String, default="")
    router_probability = Column(Float, default=0.0)
    bone_confidence = Column(Float, default=0.0)
    model_used = Column(String, default="specialist")
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(engine)


def _ensure_missing_columns() -> None:
    inspector = inspect(engine)
    print(f"Inspector: {inspector}")
    required = {
        "xrays": {
            "study_uid": "VARCHAR DEFAULT ''",
            "gradcam_path": "VARCHAR DEFAULT ''",
            "fracture": "BOOLEAN DEFAULT FALSE",
            "confidence": "DOUBLE PRECISION DEFAULT 0",
            "model_used": "VARCHAR DEFAULT 'specialist'",
            "attention_score": "DOUBLE PRECISION DEFAULT 0",
        },
        "analyses": {
            "study_uid": "VARCHAR DEFAULT ''",
            "gradcam_path": "VARCHAR DEFAULT ''",
            "router_probability": "DOUBLE PRECISION DEFAULT 0",
        },
    }

    with engine.begin() as conn:
        for table_name, columns in required.items():
            print(f"Checking table: {table_name}")
            existing = {c["name"] for c in inspector.get_columns(table_name)}
            print(f"Existing columns: {existing}")
            for col_name, sql_type in columns.items():
                if col_name not in existing:
                    print(f"Adding column {col_name} to {table_name}")
                    conn.execute(
                        text(
                            f'ALTER TABLE "{table_name}" ADD COLUMN "{col_name}" {sql_type}'
                        )
                    )


_ensure_missing_columns()
