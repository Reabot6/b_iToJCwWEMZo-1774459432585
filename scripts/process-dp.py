#!/usr/bin/env python3
"""
NIMEPA DP Generator - Background Removal Only
Returns only the transparent cut-out person for frontend positioning
"""

import sys
import json
import traceback
from PIL import Image
import rembg

def process_dp(input_path: str, output_path: str, name: str = "") -> dict:
    try:
        print("[DP] Loading user photo...", file=sys.stderr)
        user_img = Image.open(input_path).convert("RGBA")

        print("[DP] Removing background (low memory mode)...", file=sys.stderr)
        
        # Low memory + good quality settings
        no_bg = rembg.remove(
            user_img,
            alpha_matting=False,           # Prevents memory errors
            # If you want better edges later and have enough RAM, you can set True
        )

        # Optional: Slight resize to make it easier to position (max 800px height)
        max_height = 800
        if no_bg.height > max_height:
            ratio = max_height / no_bg.height
            new_width = int(no_bg.width * ratio)
            no_bg = no_bg.resize((new_width, max_height), Image.Resampling.LANCZOS)

        # Save as PNG with transparency
        no_bg.save(output_path, "PNG", optimize=True)

        print(f"[DP] Success! Transparent cutout saved to {output_path}", file=sys.stderr)

        return {
            "success": True,
            "message": "Background removed successfully",
            "name": name.strip()
        }

    except Exception as e:
        error_msg = traceback.format_exc()
        print(f"[DP] ERROR: {error_msg}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e)
        }


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments. Usage: process-dp.py <input> <output> [name]"}))
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else ""

    result = process_dp(input_path, output_path, name)
    print(json.dumps(result))


if __name__ == "__main__":
    main()