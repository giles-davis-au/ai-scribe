import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { z } from "zod";
import { errorHandler } from "./errorHandler";
import {
  AppError,
  AuthError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  // Allow res.status(n).json(…) chaining
  (res.status as jest.Mock).mockReturnValue(res);
  return res;
}

const req = {} as Request;
const next = jest.fn() as unknown as NextFunction;

function realZodError(): z.ZodError {
  try {
    z.object({ name: z.string(), age: z.number() }).parse({
      name: 42,
      age: "old",
    });
  } catch (e) {
    return e as z.ZodError;
  }
  throw new Error("Expected ZodError was not thrown");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("errorHandler middleware", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress console.error noise for unknown-error tests
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("multer errors", () => {
    it("returns 422 with the multer error message", () => {
      const res = makeRes();
      const err = new multer.MulterError("LIMIT_FILE_SIZE");

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ error: err.message });
    });

    it("uses the specific multer message, not a generic string", () => {
      const res = makeRes();
      const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE");

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith({ error: err.message });
      expect((res.json as jest.Mock).mock.calls[0][0].error).not.toBe(
        "Internal server error",
      );
    });
  });

  describe("AppError subclasses", () => {
    it("returns 401 for AuthError", () => {
      const res = makeRes();
      errorHandler(new AuthError("Token expired"), req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Token expired" });
    });

    it("returns 404 for NotFoundError", () => {
      const res = makeRes();
      errorHandler(new NotFoundError("Session not found"), req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Session not found" });
    });

    it("returns 422 for ValidationError", () => {
      const res = makeRes();
      errorHandler(
        new ValidationError("Session is already processing"),
        req,
        res,
        next,
      );
      //    expect(res.status).toHaveBeenCalledWith(422); GBD breaking for BuildKite fail test
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        error: "Session is already processing",
      });
    });

    it("uses the statusCode from the AppError, not a hardcoded value", () => {
      // Ensures arbitrary AppError subclasses with custom codes are handled correctly
      const res = makeRes();
      const err = new AppError("Payment required", 402);

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
    });
  });

  describe("ZodError", () => {
    it("returns 422 with validation failed message and flattened field errors", () => {
      const res = makeRes();
      const err = realZodError();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        error: "Validation failed",
        details: err.flatten().fieldErrors,
      });
    });

    it("includes field-level detail, not just a generic message", () => {
      const res = makeRes();
      errorHandler(realZodError(), req, res, next);

      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(body).toHaveProperty("details");
      expect(body.details).not.toEqual({});
    });
  });

  describe("unknown errors", () => {
    it("returns 500 with a generic message for a plain Error", () => {
      const res = makeRes();
      errorHandler(new Error("unexpected crash"), req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });

    it("returns 500 for a thrown string", () => {
      const res = makeRes();
      errorHandler("something went wrong", req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });

    it("returns 500 for a thrown null", () => {
      const res = makeRes();
      errorHandler(null, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });

    it("logs the unhandled error to console.error", () => {
      const res = makeRes();
      const err = new Error("surprise");
      errorHandler(err, req, res, next);

      expect(consoleSpy).toHaveBeenCalledWith("[unhandled error]", err);
    });

    it("does not leak internal error details in the response body", () => {
      const res = makeRes();
      errorHandler(new Error("db password is hunter2"), req, res, next);

      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(JSON.stringify(body)).not.toContain("hunter2");
    });
  });

  describe("error classification boundaries", () => {
    it("does not treat a plain Error as an AppError", () => {
      const res = makeRes();
      // Plain Error has no statusCode — must not accidentally use undefined as status
      errorHandler(new Error("plain"), req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("does not treat a ZodError as an unknown error", () => {
      const res = makeRes();
      errorHandler(realZodError(), req, res, next);

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("does not treat a MulterError as an unknown error", () => {
      const res = makeRes();
      errorHandler(new multer.MulterError("LIMIT_FILE_SIZE"), req, res, next);

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
