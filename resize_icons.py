from PIL import Image
import sys
import os

def resize_icon(src, sizes, out_dir):
    try:
        img = Image.open(src)
        for size in sizes:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            out_path = os.path.join(out_dir, f'icon-{size}.png')
            resized.save(out_path, format="PNG")
            print(f"Saved {out_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    src_icon = sys.argv[1]
    out_dir = sys.argv[2]
    
    sizes = [16, 32, 48, 128]
    resize_icon(src_icon, sizes, out_dir)
    
    # Also save the original size as 1280x800 for the promo tile if needed? No, we will just copy the promo tile over.
