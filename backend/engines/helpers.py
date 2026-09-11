from engines.resources import BLANK_WHITE_PAGE_URI


def apply_print_binding_padding(rendered_pages, binding_style, add_flyleaves=False, mag_pad_choice="At the very end"):
    if not rendered_pages:
        return rendered_pages

    pages = list(rendered_pages)
    n = len(pages)

    # 1. First, handle Magazine 4-page signature imposition
    if "Magazine" in binding_style:
        rem = n % 4
        if rem != 0:
            pad_count = 4 - rem
            if n == 1:
                result = [pages[0]] + [BLANK_WHITE_PAGE_URI] * pad_count
            else:
                front_cover = pages[0]
                inside_pages = pages[1:-1]
                back_cover = pages[-1]
                filler = [BLANK_WHITE_PAGE_URI] * pad_count

                if mag_pad_choice == "After front cover":
                    result = [front_cover] + filler + inside_pages + [back_cover]
                elif mag_pad_choice == "Before back cover":
                    result = [front_cover] + inside_pages + filler + [back_cover]
                else:
                    result = [front_cover] + inside_pages + [back_cover] + filler
        else:
            result = list(pages)

        if add_flyleaves:
            result = [BLANK_WHITE_PAGE_URI] + result + [BLANK_WHITE_PAGE_URI]
        return result

    # 2. For Soft Cover & Hard Cover books:
    # If the document has an odd number of pages (and n > 1), the last page is the Back Cover.
    # We MUST insert 1 blank page BEFORE the back cover so the back cover renders on the outside back spread.
    if n > 1 and n % 2 != 0:
        front_cover = pages[0]
        inside_pages = pages[1:-1]
        back_cover = pages[-1]
        pages = [front_cover] + inside_pages + [BLANK_WHITE_PAGE_URI] + [back_cover]
        n = len(pages)  # n is now even

    # 3. Apply Hard Cover flyleaves if enabled
    if "Hard Cover" in binding_style and add_flyleaves:
        if n == 1:
            return [pages[0]] + [BLANK_WHITE_PAGE_URI] * 6
        else:
            front_cover = pages[0]
            inside_pages = pages[1:-1]
            back_cover = pages[-1]
            flyleaves = [BLANK_WHITE_PAGE_URI] * 3
            return [front_cover] + flyleaves + inside_pages + flyleaves + [back_cover]

    return pages


PAPER_CALIPERS_MM = {
    "plain 80g": 0.095,   # Standard 80gsm Offset / Bond
    "plain 120g": 0.140,  # 120gsm Offset / Premium Smooth
    "coche 115g": 0.090,        # 115gsm Coated Gloss/Matte Art Paper (higher density)
    "coche 200g": 0.165,        # 200gsm Coated Gloss/Matte Art Paper
    "bristol 230g": 0.285       # 230gsm Heavy Multi-ply Bristol Board
}


def calculate_spine_thickness(page_count: int, paper_type: str, sides: str = "2 side print", cover_type: str = "Soft Cover") -> dict:
    """
    Calculates precise book spine thickness in mm and inches based on paper material, print sides, and cover style.
    
    Args:
        page_count: Total number of pages in the PDF document.
        paper_type: Key matching PAPER_CALIPERS_MM ('plain paper 80g', etc.).
        sides: '1 side print' or '2 side print'.
        cover_type: 'Soft Cover' or 'Hard Cover'.

    Returns:
        dict: containing spine_mm, spine_in, num_sheets, caliper_mm, total_width_with_cover_mm
    """
    caliper = PAPER_CALIPERS_MM.get(paper_type.lower(), 0.095)
    
    # 1 side print = 1 page per sheet; 2 side print = 2 pages per sheet
    if "1 side" in sides.lower() or "simplex" in sides.lower():
        num_sheets = page_count
    else:
        num_sheets = (page_count + 1) // 2

    # Core book block thickness
    block_spine_mm = num_sheets * caliper

    # Additional cover allowance
    # Hard Cover: 2x 2.0mm greyboards + hinge joint wrap allowance (~4.5mm total extra)
    # Soft Cover: 2x ~0.25mm cover paper thickness (~0.5mm total extra)
    if "hard" in cover_type.lower():
        cover_allowance_mm = 4.5
    else:
        cover_allowance_mm = 0.5

    total_spine_mm = block_spine_mm + cover_allowance_mm
    total_spine_in = total_spine_mm / 25.4

    return {
        "num_sheets": num_sheets,
        "caliper_mm": caliper,
        "block_spine_mm": round(block_spine_mm, 2),
        "total_spine_mm": round(total_spine_mm, 2),
        "total_spine_in": round(total_spine_in, 3)
    }

