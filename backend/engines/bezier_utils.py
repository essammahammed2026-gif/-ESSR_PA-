import numpy as np


def compute_bezier_control_points(p0, p1, p2, p3, tension):
    p0_n = np.array(p0, dtype=float)
    p1_n = np.array(p1, dtype=float)
    p2_n = np.array(p2, dtype=float)
    p3_n = np.array(p3, dtype=float)

    d01 = float(np.linalg.norm(p1_n - p0_n))
    d12 = float(np.linalg.norm(p2_n - p1_n))
    d23 = float(np.linalg.norm(p3_n - p2_n))

    if d01 < 1e-6 or d12 < 1e-6 or d23 < 1e-6:
        return None

    u01 = (p1_n - p0_n) / d01
    u12 = (p2_n - p1_n) / d12
    u23 = (p3_n - p2_n) / d23

    t1 = u01 + u12
    norm_t1 = float(np.linalg.norm(t1))
    t1_unit = u12 if norm_t1 < 1e-6 else t1 / norm_t1

    t2 = u12 + u23
    norm_t2 = float(np.linalg.norm(t2))
    t2_unit = u12 if norm_t2 < 1e-6 else t2 / norm_t2

    handle_len = min(0.35 * d12, (tension / 3.0) * d12 * 1.5)

    cp1 = p1_n + t1_unit * handle_len
    cp2 = p2_n - t2_unit * handle_len

    return (float(cp1[0]), float(cp1[1])), (float(cp2[0]), float(cp2[1]))
