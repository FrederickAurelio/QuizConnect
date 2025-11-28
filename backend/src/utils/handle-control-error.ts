import { Response } from "express";
import { ZodError } from "zod";

/**
 * centralized error handler for API controllers
 * Handles Zod errors, Mongoose Validation errors, Custom Errors, and 500s.
 */
export const handleControllerError = (res: Response, error: any) => {
  // Case A: Zod Validation Error (Bad Data Structure)
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid data structure",
      data: null,
      errors: error.format(),
    });
  }

  // Case B: Custom Business Logic Errors (e.g. from Mongoose pre-save hooks)
  // These are usually thrown as new Error("Specific message")
  // We distinguish them by checking if they have a message but NO inner 'errors' object
  if (
    error instanceof Error &&
    !(error as any).errors &&
    error.name !== "ValidationError"
  ) {
    return res.status(400).json({
      message: error.message,
      data: null,
      errors: null,
    });
  }

  // Case C: Mongoose Standard Schema Validation Errors
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return res.status(400).json({
      message: "Validation failed",
      data: null,
      errors: messages,
    });
  }

  // Case D: Internal Server Error
  console.error("API Error:", error);
  return res.status(500).json({
    message: "Internal server error",
    data: null,
    errors: null,
  });
};
