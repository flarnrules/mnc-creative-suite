"""Stage the shared workspace from a tested local release in the Pages checkout."""

import argparse
import json
from pathlib import Path
import re
from zipfile import BadZipFile, ZipFile


# These files contain the portable UI and renderers. The web edition supplies its
# own project storage, starter data, artwork, and lab assets.
SHARED_STUDIO = """
app.js art-cutout.js artwork-profiles.js back-model.js back-render.js
back-studio.css back-studio.js card-metadata.js catalog-model.js catalog-schema.js
catalog-ui.js catalog-xlsx.js cutout-editor.js design-system-ui.js
design-system.css front-effects.js front-layout.js front-studio.js game-frame.js
game-model.js game-studio.js glyph-context-ui.js glyph_font_bridge.js
glyph_fonts_manifest.js index.html lab-links.js layout-design.js
layout-designer.css layout-designer.js layout-fill-inspector.js mirror-mask.js
mirror-studio.js outer-border.js print-proof.js set-model.js shape-model.js
shape-studio.css shape-studio.js standard_and_prism.js style.css suite.js
symbols.js type-design-ui.js type-design.js type-glyphs.js workspace.css
labs/fold-model.mjs labs/fractal-families.mjs labs/fractal-lab.css
labs/loop-gif.mjs labs/mnc-foil-bridge.js labs/motion-model.mjs labs/palette.mjs
""".split()


def read_shared_release(path):
    with ZipFile(path) as archive:
        names = archive.namelist()
        if names.count("mnc-release.json") != 1:
            raise ValueError("Choose a direct Release ZIP with mnc-release.json at its root.")
        manifest = json.loads(archive.read("mnc-release.json"))
        version = manifest.get("version", "")
        if (not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version)
                or manifest.get("format") != 1 or manifest.get("shared_studio") != 1):
            raise ValueError("Use a paired release with a three-part version, starting at 0.9.14.")
        paths = [f"studio/{name}" for name in SHARED_STUDIO]
        for name in paths:
            if names.count(name) != 1:
                raise ValueError(f"Expected exactly one {name} in the release.")
        content = {name: archive.read(name) for name in paths}
        html = content["studio/index.html"].decode("utf-8")
        if f"<title>MNC Creative Suite · {version}</title>" not in html:
            raise ValueError("The release manifest and studio title show different versions.")
    return version, content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("release", type=Path, help="Path to the direct local Release ZIP.")
    parser.add_argument("--check", action="store_true", help="Check that the checkout matches the ZIP.")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        version, files = read_shared_release(args.release)
        changed = []
        for name, content in files.items():
            target = root / name
            if not target.resolve().is_relative_to(root):
                raise ValueError(f"The checkout points outside the repository at {name}.")
            if not target.is_file() or target.read_bytes() != content:
                changed.append(name)
        if args.check and changed:
            parser.exit(1, "Different from the release:\n" + "\n".join(changed) + "\n")
        for name in changed:
            (root / name).write_bytes(files[name])
        print(f"Creative Suite {version} • {len(files)} shared files match the local release.")
    except (OSError, BadZipFile, ValueError, TypeError, AttributeError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
