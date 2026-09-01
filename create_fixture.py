import os
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def create_compressible_jpeg(filename, color_start, color_end, text):
    img = Image.new('RGB', (1920, 1080), color_start)
    draw = ImageDraw.Draw(img)
    # Add some noise or gradient so it's not perfectly compressible by run-length,
    # but still highly compressible by JPEG when quality drops.
    for y in range(1080):
        r = int(color_start[0] + (color_end[0] - color_start[0]) * y / 1080)
        g = int(color_start[1] + (color_end[1] - color_start[1]) * y / 1080)
        b = int(color_start[2] + (color_end[2] - color_start[2]) * y / 1080)
        draw.line([(0, y), (1920, y)], fill=(r, g, b))
    
    # Draw some shapes to make it a bit more complex
    draw.rectangle([500, 300, 1420, 780], outline=(255, 255, 255), width=20)
    draw.ellipse([800, 400, 1120, 720], fill=(255, 200, 100))
    
    # Save as high quality JPEG to make it large
    img.save(filename, 'JPEG', quality=100)

create_compressible_jpeg('img1.jpg', (50, 100, 200), (200, 100, 50), 'Image 1')
create_compressible_jpeg('img2.jpg', (100, 200, 50), (50, 100, 200), 'Image 2')
create_compressible_jpeg('img3_shared.jpg', (200, 50, 100), (100, 200, 200), 'Shared Image')

# Create PDF with no compression
c = canvas.Canvas('test_fixture.pdf', pagesize=letter, pageCompression=0)

# Page 1: img1 and text
c.drawString(100, 750, "This is page 1 text. It should remain selectable.")
c.drawImage('img1.jpg', 50, 400, width=500, height=300)
c.showPage()

# Page 2: img2 and text
c.drawString(100, 750, "This is page 2 text. It should remain selectable.")
c.drawImage('img2.jpg', 50, 400, width=500, height=300)
c.showPage()

# Page 3: shared image and text
c.drawString(100, 750, "This is page 3 text. Image below is shared.")
c.drawImage('img3_shared.jpg', 50, 400, width=500, height=300)
c.showPage()

# Page 4: shared image again
c.drawString(100, 750, "This is page 4 text. Image below is the same shared image as page 3.")
c.drawImage('img3_shared.jpg', 50, 400, width=500, height=300)
c.showPage()

c.save()

print("Created test_fixture.pdf")
print("Size of test_fixture.pdf:", os.path.getsize('test_fixture.pdf'))
print("Size of img1.jpg:", os.path.getsize('img1.jpg'))
print("Size of img2.jpg:", os.path.getsize('img2.jpg'))
print("Size of img3_shared.jpg:", os.path.getsize('img3_shared.jpg'))
