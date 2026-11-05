import io
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from config import MAX_UPLOAD_BYTES
from db import get_db
from security import current_user, require_candidate
from services import extract, pdf, skills

router = APIRouter(prefix="/resumes", tags=["resumes"])

ALLOWED_SUFFIXES = {".pdf": "application/pdf",
                   ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


@router.post("", status_code=201)
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db),
                        user: m.User = Depends(require_candidate)):
    filename = (file.filename or "resume.pdf").strip()
    suffix = filename[filename.rfind("."):].lower() if "." in filename else ""
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            "Upload a PDF or DOCX resume. Legacy .doc files must be re-saved "
                            "as .docx or PDF.")
    blob = await file.read()
    if not blob:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty.")
    if len(blob) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")

    target = f"user{user.id}_{int(__import__('time').time())}{suffix}"
    from config import DATA_DIR

    (DATA_DIR / "resumes").mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "resumes" / target
    path.write_bytes(blob)

    parse_status, parse_error, raw, pages = "failed", None, "", 0
    try:
        raw, pages = pdf.extract_any(path)
        parse_status, parse_error = pdf.classify(raw)
    except pdf.ParseFailure as exc:
        parse_status, parse_error = "failed", str(exc)

    profile = None
    if parse_status == "ok":
        profile, _mode = extract.extract(raw)

    r = m.Resume(candidate_id=user.id, filename=filename, mime=ALLOWED_SUFFIXES[suffix],
                 stored_path=target,
                 size_bytes=len(blob), page_count=pages, raw_text=raw,
                 parse_status=parse_status, parse_error=parse_error,
                 extracted_json=extract.dumps(profile) if profile else None)
    db.add(r)
    db.commit()
    db.refresh(r)
    if parse_status != "ok":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"detail": parse_error, "resume_id": r.id})
    return {"resume": S.resume(r), "extracted": profile}


@router.get("/mine")
def my_resumes(db: Session = Depends(get_db), user: m.User = Depends(require_candidate)):
    rows = db.scalars(select(m.Resume).where(m.Resume.candidate_id == user.id)
                      .order_by(m.Resume.created_at.desc())).all()
    return [S.resume(r) for r in rows]


@router.get("/{resume_id}")
def get_resume(resume_id: int, db: Session = Depends(get_db),
               user: m.User = Depends(current_user)):
    r = db.get(m.Resume, resume_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    if user.role == "candidate" and r.candidate_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only view your own resume")
    return S.resume(r)


@router.get("/{resume_id}/file")
def resume_file(resume_id: int, db: Session = Depends(get_db),
                user: m.User = Depends(current_user)):
    """Stream the original PDF/DOCX so recruiters can actually read a candidate's CV."""
    r = db.get(m.Resume, resume_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    if user.role == "candidate" and r.candidate_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only open your own resume")
    path = None
    if r.stored_path:
        from config import DATA_DIR

        path = DATA_DIR / "resumes" / r.stored_path
    if not path or not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The original file is not stored on this server")
    # inline so a PDF opens in the browser tab instead of only downloading.
    return FileResponse(path, media_type=r.mime or "application/pdf",
                        filename=r.filename or path.name, content_disposition_type="inline")


@router.patch("/{resume_id}/skills")
def patch_skills(resume_id: int, body: schemas.SkillsPatchIn, db: Session = Depends(get_db),
                 user: m.User = Depends(require_candidate)):
    """Candidate correction of extracted skills (spec 3.3)."""
    r = db.get(m.Resume, resume_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    if r.candidate_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only correct your own resume")
    profile = extract.loads(r.extracted_json) or {}
    existing = {s["canonical"]: s for s in profile.get("skills") or []}
    out = []
    for label in body.skills:
        canon = skills.canonical(label)
        if canon in existing:
            out.append(existing[canon])
        else:
            out.append({"label": skills.display(canon), "canonical": canon, "quote": None,
                        "start": None, "end": None, "support": "flagged_unverified"})
    profile["skills"] = out
    r.extracted_json = json.dumps(profile, ensure_ascii=False)
    db.commit()
    return S.resume(r)
