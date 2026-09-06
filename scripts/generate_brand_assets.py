from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "fitide-logo-v2.png"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
NAVY = (11, 21, 30, 255)


def normalized_logo() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("The source logo has no visible pixels")

    cropped = image.crop(bounds)
    side = max(cropped.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(
        cropped,
        ((side - cropped.width) // 2, (side - cropped.height) // 2),
    )
    return canvas


def contain(image: Image.Image, size: tuple[int, int], scale: float) -> Image.Image:
    max_width = max(1, round(size[0] * scale))
    max_height = max(1, round(size[1] * scale))
    ratio = min(max_width / image.width, max_height / image.height)
    rendered = image.resize(
        (max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(
        rendered,
        ((size[0] - rendered.width) // 2, (size[1] - rendered.height) // 2),
    )
    return canvas


def save_web_icons(logo: Image.Image) -> None:
    for size in (32, 192, 512):
        icon = Image.new("RGBA", (size, size), NAVY)
        icon.alpha_composite(contain(logo, (size, size), 0.76))
        icon.save(ROOT / "public" / f"fitide-icon-{size}.png", optimize=True)


def save_android_icons(logo: Image.Image) -> None:
    densities = {
        "ldpi": (36, 81),
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }

    for density, (legacy_size, foreground_size) in densities.items():
        target = ANDROID_RES / f"mipmap-{density}"
        target.mkdir(parents=True, exist_ok=True)

        legacy = Image.new("RGBA", (legacy_size, legacy_size), NAVY)
        legacy.alpha_composite(contain(logo, legacy.size, 0.76))
        legacy.save(target / "ic_launcher.png", optimize=True)
        legacy.save(target / "ic_launcher_round.png", optimize=True)

        foreground = contain(logo, (foreground_size, foreground_size), 0.56)
        foreground.save(target / "ic_launcher_foreground.png", optimize=True)


def save_splashes(logo: Image.Image) -> None:
    splash_sizes = {
        "drawable/splash.png": (480, 320),
        "drawable-land-mdpi/splash.png": (480, 320),
        "drawable-land-hdpi/splash.png": (800, 480),
        "drawable-land-xhdpi/splash.png": (1280, 720),
        "drawable-land-xxhdpi/splash.png": (1600, 960),
        "drawable-land-xxxhdpi/splash.png": (1920, 1280),
        "drawable-port-mdpi/splash.png": (320, 480),
        "drawable-port-hdpi/splash.png": (480, 800),
        "drawable-port-xhdpi/splash.png": (720, 1280),
        "drawable-port-xxhdpi/splash.png": (960, 1600),
        "drawable-port-xxxhdpi/splash.png": (1280, 1920),
    }

    for relative_path, size in splash_sizes.items():
        splash = Image.new("RGBA", size, NAVY)
        mark_size = round(min(size) * 0.42)
        mark = contain(logo, (mark_size, mark_size), 0.94)
        splash.alpha_composite(
            mark,
            ((size[0] - mark.width) // 2, (size[1] - mark.height) // 2),
        )
        splash.convert("RGB").save(ANDROID_RES / relative_path, optimize=True)


def main() -> None:
    logo = normalized_logo()
    save_web_icons(logo)
    save_android_icons(logo)
    save_splashes(logo)


if __name__ == "__main__":
    main()
