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

