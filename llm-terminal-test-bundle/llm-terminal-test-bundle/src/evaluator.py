from __future__ import annotations

import json
import re
from typing import Any

from jsonschema import validate, ValidationError

from utils import read_json_file


def try_parse_json(text: str) -> tuple[bool, Any]:
    try:
        return True, json.loads(text)
    except Exception:
        return False, None


def evaluate_response(testcase: dict[str, Any], response: str) -> dict[str, Any]:
    errors: list[str] = []
    parsed_json = None

    for needle in testcase.get("must_include", []):
        if needle.lower() not in response.lower():
            errors.append(f"Missing required phrase: {needle}")

    for needle in testcase.get("must_not_include", []):
        if needle.lower() in response.lower():
            errors.append(f"Forbidden phrase present: {needle}")

    contains_any = testcase.get("contains_any", [])
    if contains_any and not any(value.lower() in response.lower() for value in contains_any):
        errors.append(f"Response must contain at least one of: {contains_any}")

    max_chars = testcase.get("max_chars")
    if isinstance(max_chars, int) and len(response) > max_chars:
        errors.append(f"Response too long: {len(response)} > {max_chars}")

    for pattern in testcase.get("regex_must_match", []):
        if re.search(pattern, response) is None:
            errors.append(f"Regex did not match: {pattern}")

    for pattern in testcase.get("regex_must_not_match", []):
        if re.search(pattern, response) is not None:
            errors.append(f"Forbidden regex matched: {pattern}")

    if testcase.get("expect_json"):
        ok, parsed_json = try_parse_json(response)
        if not ok:
            errors.append("Response is not valid JSON")
        else:
            for key in testcase.get("required_keys", []):
                if key not in parsed_json:
                    errors.append(f"Missing JSON key: {key}")

            schema_path = testcase.get("json_schema_path")
            if schema_path:
                try:
                    schema = read_json_file(schema_path)
                    validate(instance=parsed_json, schema=schema)
                except ValidationError as exc:
                    errors.append(f"JSON Schema validation failed: {exc.message}")
                except FileNotFoundError:
                    errors.append(f"JSON schema file not found: {schema_path}")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "response": response,
        "parsed_json": parsed_json,
    }
