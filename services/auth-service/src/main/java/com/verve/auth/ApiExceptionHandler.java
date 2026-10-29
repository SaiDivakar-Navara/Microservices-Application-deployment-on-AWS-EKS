package com.verve.auth;

import java.util.Map;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Every error leaves this service as {"error": "message"}. */
@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
    String reason = e.getReason() == null ? e.getStatusCode().toString() : e.getReason();
    return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", reason));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<Map<String, String>> handleBadJson(HttpMessageNotReadableException e) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "request body is not valid JSON"));
  }

  @ExceptionHandler(DuplicateKeyException.class)
  public ResponseEntity<Map<String, String>> handleDuplicate(DuplicateKeyException e) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "An account with this email already exists."));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handleOther(Exception e) {
    // Spring's own errors (unknown route, wrong HTTP method, ...) already carry the right status.
    if (e instanceof ErrorResponse errorResponse) {
      String detail = errorResponse.getBody().getDetail();
      return ResponseEntity.status(errorResponse.getStatusCode())
          .body(Map.of("error", detail == null ? "request failed" : detail));
    }
    e.printStackTrace();
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "internal server error"));
  }
}
