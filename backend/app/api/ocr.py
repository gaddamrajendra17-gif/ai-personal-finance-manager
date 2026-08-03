from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os
import shutil
import uuid
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.ai.ocr_parser import parse_receipt_image

router = APIRouter(prefix="/api/ocr", tags=["Receipt Scanning"])

TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/scan")
async def scan_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a receipt image (JPEG/PNG) and extract transaction data.
    """
    # Verify file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt"]:
        raise HTTPException(status_code=400, detail="Unsupported file format")

    # Generate unique temporary file name
    temp_file_name = f"{uuid.uuid4()}_{file.filename}"
    temp_file_path = os.path.join(TEMP_DIR, temp_file_name)

    try:
        # Save uploaded file to temp directory
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Parse transaction metadata from image
        parsed_data = parse_receipt_image(temp_file_path, original_filename=file.filename)
        return {
            "success": True,
            "filename": file.filename,
            "parsed_data": parsed_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process receipt: {str(e)}")

    finally:
        # Clean up temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

