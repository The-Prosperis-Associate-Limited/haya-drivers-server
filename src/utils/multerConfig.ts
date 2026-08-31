import multer from "multer";

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

export const upload = multer({ storage });

// The onboarding screens promise "JPG, PNG or PDF · up to 5 MB". Enforced here
// so the client copy and the server agree.
export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG or PDF files are accepted"));
    }
    cb(null, true);
  },
});
