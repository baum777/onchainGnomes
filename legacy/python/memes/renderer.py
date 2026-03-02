"""
Python wrapper for TypeScript Sharp-based meme renderer.

Provides a Python interface to the TypeScript meme rendering pipeline
via subprocess calls to the compiled Node.js scripts.
"""

import json
import os
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Optional


class RendererError(Exception):
    """Raised when meme rendering fails."""

    def __init__(self, message: str, stderr: Optional[str] = None, return_code: Optional[int] = None):
        super().__init__(message)
        self.stderr = stderr
        self.return_code = return_code


@dataclass
class RenderMemeArgs:
    """Arguments for rendering a meme."""

    template_key: str
    base_image_path: str
    text_by_zone: Dict[str, str]
    out_path: str
    overlay_image_paths: Optional[List[str]] = None
    canvas_size: int = 1024

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "template": self.template_key,
            "baseImagePath": self.base_image_path,
            "textByZone": self.text_by_zone,
            "outPath": self.out_path,
            "overlayImagePaths": self.overlay_image_paths or [],
            "canvasSize": self.canvas_size,
        }


class MemeRenderer:
    """
    Python wrapper for the TypeScript Sharp meme renderer.

    Handles:
    - Calling the TypeScript rendering script via Node.js
    - Managing output paths
    - Error handling and validation
    """

    DEFAULT_OUTPUT_DIR = "out/memes"
    DEFAULT_ASSETS_DIR = "assets"
    DEFAULT_OVERLAYS_DIR = "memes/overlays"

    def __init__(
        self,
        output_dir: str = DEFAULT_OUTPUT_DIR,
        assets_dir: str = DEFAULT_ASSETS_DIR,
        overlays_dir: str = DEFAULT_OVERLAYS_DIR,
        use_compiled: bool = True,
    ):
        """
        Initialize the meme renderer.

        Args:
            output_dir: Directory for rendered output files
            assets_dir: Directory containing base images
            overlays_dir: Directory containing overlay PNGs
            use_compiled: If True, use compiled dist/ JS; if False, use ts-node
        """
        self.output_dir = Path(output_dir)
        self.assets_dir = Path(assets_dir)
        self.overlays_dir = Path(overlays_dir)
        self.use_compiled = use_compiled

        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _get_render_script(self) -> str:
        """Get the path to the render script."""
        if self.use_compiled:
            return "dist/scripts/render_meme.js"
        return "scripts/render_meme.ts"

    def _resolve_overlays(self, overlay_names: List[str]) -> List[str]:
        """Resolve overlay names to full paths."""
        return [str(self.overlays_dir / name) for name in overlay_names]

    def render(
        self,
        template_key: str,
        text_by_zone: Dict[str, str],
        base_image: Optional[str] = None,
        overlay_names: Optional[List[str]] = None,
        out_filename: Optional[str] = None,
        canvas_size: int = 1024,
    ) -> Path:
        """
        Render a meme using the TypeScript renderer.

        Args:
            template_key: Template identifier (e.g., 'gorky_courtroom')
            text_by_zone: Mapping of zone names to text values
            base_image: Path to base image (relative to assets_dir, or absolute)
            overlay_names: List of overlay PNG filenames
            out_filename: Output filename (auto-generated if None)
            canvas_size: Canvas size in pixels

        Returns:
            Path to the rendered output file

        Raises:
            RendererError: If rendering fails
            FileNotFoundError: If base image or overlays don't exist
        """
        # Resolve base image path
        if base_image is None:
            base_image_path = str(self.assets_dir / "demo_base.png")
        elif Path(base_image).is_absolute():
            base_image_path = base_image
        else:
            base_image_path = str(self.assets_dir / base_image)

        if not Path(base_image_path).exists():
            raise FileNotFoundError(f"Base image not found: {base_image_path}")

        # Generate output filename if not provided
        if out_filename is None:
            import uuid
            out_filename = f"meme_{template_key}_{uuid.uuid4().hex[:8]}.png"

        out_path = str(self.output_dir / out_filename)

        # Resolve overlay paths
        overlay_paths = None
        if overlay_names:
            overlay_paths = self._resolve_overlays(overlay_names)
            for p in overlay_paths:
                if not Path(p).exists():
                    raise FileNotFoundError(f"Overlay not found: {p}")

        # Build render arguments
        args = RenderMemeArgs(
            template_key=template_key,
            base_image_path=base_image_path,
            text_by_zone=text_by_zone,
            out_path=out_path,
            overlay_image_paths=overlay_paths,
            canvas_size=canvas_size,
        )

        # Call the TypeScript renderer
        return self._render_with_node(args)

    def _render_with_node(self, args: RenderMemeArgs) -> Path:
        """
        Execute the TypeScript renderer via Node.js.

        Args:
            args: RenderMemeArgs containing all rendering parameters

        Returns:
            Path to the rendered output file

        Raises:
            RendererError: If the rendering process fails
        """
        script = self._get_render_script()

        # Check if we need to use ts-node for TypeScript files
        if script.endswith(".ts"):
            cmd = ["npx", "ts-node", script]
        else:
            cmd = ["node", script]

        # Pass arguments as JSON via environment variable
        env = os.environ.copy()
        env["MEME_RENDER_ARGS"] = json.dumps(args.to_dict())

        try:
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=60,  # 60 second timeout
            )

            if result.returncode != 0:
                raise RendererError(
                    f"Rendering failed: {result.stdout or result.stderr}",
                    stderr=result.stderr,
                    return_code=result.returncode,
                )

            # Verify output file was created
            output_path = Path(args.out_path)
            if not output_path.exists():
                raise RendererError(
                    f"Output file not created: {args.out_path}",
                    stderr=result.stderr,
                )

            return output_path

        except subprocess.TimeoutExpired:
            raise RendererError("Rendering timed out after 60 seconds")
        except FileNotFoundError as e:
            if "ts-node" in str(e) or "node" in str(e):
                raise RendererError(
                    "Node.js/ts-node not found. Run 'npm install' first."
                )
            raise

    def render_simple(
        self,
        template_key: str,
        header: str = "",
        verdict: str = "",
        footer: str = "",
        base_image: Optional[str] = None,
        out_filename: Optional[str] = None,
    ) -> Path:
        """
        Simplified render method for common 3-zone templates.

        Args:
            template_key: Template identifier
            header: Text for header zone
            verdict: Text for verdict zone
            footer: Text for footer zone
            base_image: Base image path
            out_filename: Output filename

        Returns:
            Path to rendered output
        """
        text_by_zone = {}
        if header:
            text_by_zone["header"] = header
        if verdict:
            text_by_zone["verdict"] = verdict
        if footer:
            text_by_zone["footer"] = footer

        return self.render(
            template_key=template_key,
            text_by_zone=text_by_zone,
            base_image=base_image,
            out_filename=out_filename,
        )

    def list_available_templates(self) -> List[str]:
        """List available template keys from the templates directory."""
        templates_dir = Path("memes/templates")
        if not templates_dir.exists():
            return []

        templates = []
        for f in templates_dir.iterdir():
            if f.suffix in (".yaml", ".yml"):
                templates.append(f.stem)
        return sorted(templates)

    def list_available_overlays(self) -> List[str]:
        """List available overlay PNGs."""
        if not self.overlays_dir.exists():
            return []

        return sorted([f.name for f in self.overlays_dir.iterdir() if f.suffix == ".png"])
