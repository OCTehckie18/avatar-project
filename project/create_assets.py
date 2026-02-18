from PIL import Image, ImageDraw, ImageFont
import os

# Ensure we are working relative to this script's location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AVATAR_DIR = os.path.join(BASE_DIR, 'static', 'avatars')
os.makedirs(AVATAR_DIR, exist_ok=True)

def create_avatar(filename, gender, attire, bg_color, text_color):
    width, height = 400, 600
    img = Image.new('RGB', (width, height), color=bg_color)
    d = ImageDraw.Draw(img)
    
    # Body
    d.rectangle([(100, 200), (300, 600)], fill=(200, 200, 200)) # Generic body
    
    # Head
    d.ellipse([(140, 100), (260, 220)], fill=(255, 224, 189)) # Skin tone
    
    # Attire specific details
    if attire == 'formal':
        # Suit jacket
        d.rectangle([(100, 220), (300, 600)], fill=(50, 50, 80)) # Dark Blue Suit/Blazer
        # Shirt V
        d.polygon([(150, 220), (250, 220), (200, 300)], fill=(255, 255, 255))
        # Tie (simplified)
        d.polygon([(190, 220), (210, 220), (200, 300)], fill=(150, 0, 0)) # Red Tie
    else:
        # Casual T-Shirt
        d.rectangle([(100, 220), (300, 600)], fill=(100, 150, 200)) # Blue/Teal Shirt
        # Round Neck
        d.arc([(140, 200), (260, 240)], start=0, end=180, fill=(255, 224, 189), width=10)

    # Hair (Simple)
    if gender == 'male':
        d.arc([(140, 100), (260, 150)], start=180, end=0, fill=(50, 30, 0), width=20)
    else:
        # Female hair (longer)
        d.rectangle([(130, 120), (270, 250)], fill=(50, 30, 0))

    try:
        font = ImageFont.load_default()
    except:
        font = None

    d.text((20, 20), f"{gender.title()} - {attire.title()}", fill=text_color)
    
    path = os.path.join(AVATAR_DIR, filename)
    img.save(path)
    print(f"Created {path}")

# Generate 4 variations
create_avatar('male_formal.png', 'male', 'formal', '#e2e8f0', '#0f172a')
create_avatar('male_casual.png', 'male', 'casual', '#e2e8f0', '#0f172a')
create_avatar('female_formal.png', 'female', 'formal', '#fce7f3', '#831843') # Pinkish theme for female variants distinctness
create_avatar('female_casual.png', 'female', 'casual', '#fce7f3', '#831843')
