import multer from "multer";

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const IMAGE_AND_PDF_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

export const WORD_DOCUMENT_TYPES = ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export const upload = multer({ storage });

// Matches the onboarding copy (JPG, PNG or PDF, up to 5 MB); Word is allowed for a CV only, checked in the document service.
export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (![...IMAGE_AND_PDF_TYPES, ...WORD_DOCUMENT_TYPES].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, PDF or Word files are accepted"));
    }
    cb(null, true);
  },
});
