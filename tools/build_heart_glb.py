"""Build static/models/heart.glb from the Human Reference Atlas female heart (v1.0).

Source: HuBMAP Human Reference Atlas, 3D reference organ "heart-female" v1.0 (VH_F_Heart.glb), CC BY 4.0,
https://cdn.humanatlas.io/digital-objects/ref-organ/heart-female/v1.0/assets/VH_F_Heart.glb
Made by Kristen Browne (NIH) from the Visible Human Project female data set.

Usage: python tools/build_heart_glb.py <path to VH_F_Heart.glb>
Needs: pip install trimesh scipy

What it does
  - groups the named parts: myocardium (both ventricles and atria), LAD (+ diagonal), LCX (+ marginal,
    left posterior descending and posterior left ventricular branches: this heart is left-dominant), RCA
    (+ right marginal), LM, aorta, pulmonary (trunk and branches), pulmonary_veins, SVC, IVC, veins
    (great cardiac vein and coronary sinus only); valves, papillary muscles and small cardiac veins are dropped
  - trims the great vessels to short stumps and closes every open vessel end with a flat cap ("caps" mesh,
    shaded as a dark lumen like a textbook cut vessel)
  - thickens the coronary arteries slightly so their risk colour reads at screen size
  - bakes smooth tissue colours (_tissue, sRGB: wine ventricles, pinker atria) and coronary territory
    weights (_territory: LAD, LCX, RCA) into the myocardium
  - centres the heart and scales it to 2.5 units tall (viewer frame: x = patient's left, y = up, z = anterior)
"""
import sys
from pathlib import Path

import numpy as np
import trimesh
from scipy.spatial import cKDTree

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "VH_F_Heart.glb")
OUT = Path(__file__).resolve().parent.parent / "static" / "models" / "heart.glb"
MM = 0.001  # the source is in metres

GROUPS = {
    "ventricles": ["left_ventricle", "right_ventricle"],
    "atria": ["left_cardiac_atrium", "right_cardiac_atrium"],
    "LAD": ["left_anterior_descending_artery", "diagonal_branch_of_left_anterior_descending_artery"],
    "LCX": ["left_circumflex_artery", "left_marginal_branch", "posterior_left_ventricular_branch",
            "left_posterior_descending_branch_of_circumflex_branch_of_left_coronary_artery"],
    "RCA": ["right_coronary_artery", "right_marginal_artery"],
    "LM": ["left_coronary_artery"],
    "aorta": ["ascending_aorta", "aortic_arch", "descending_aorta_a", "brachiocephalic_artery_a",
              "left_common_carotid_artery_a", "left_subclavian_artery_a"],
    "pulmonary": ["pulmonary_trunk", "pulmonary_artery_L", "pulmonary_artery_R"],
    "pulmonary_veins": ["pulmonary_vein_L_sup", "pulmonary_vein_L_inf", "pulmonary_vein_R_sup", "pulmonary_vein_R_inf"],
    "SVC": ["superior_vena_cava"],
    "IVC": ["inferior_vena_cava_a"],
    "veins": ["great_cardiac_vein", "coronary_sinus"],
}
CORONARIES = ["LAD", "LCX", "RCA"]

# Trim rules: ("above"/"below", height in mm) cuts with a horizontal plane; ("axis", keep_mm) keeps that
# length of the vessel measured from its end nearest the heart, along the vessel's main axis.
TRIMS = {
    "superior_vena_cava": ("above", 486),
    "inferior_vena_cava_a": ("below", 352),
    "descending_aorta_a": ("below", 410),
    "pulmonary_artery_L": ("axis", 16),
    "pulmonary_artery_R": ("axis", 16),
    "pulmonary_vein_L_sup": ("axis", 8),
    "pulmonary_vein_L_inf": ("axis", 8),
    "pulmonary_vein_R_sup": ("axis", 8),
    "pulmonary_vein_R_inf": ("axis", 8),
}


def load_parts(path):
    scene = trimesh.load(path)
    parts = {}
    for node in scene.graph.nodes_geometry:
        transform, name = scene.graph[node]
        mesh = scene.geometry[name].copy()
        mesh.apply_transform(transform)
        mesh.merge_vertices()
        parts[name.replace("VHF_", "")] = mesh
    return parts


def boundary_loops(mesh):
    """Closed loops of boundary edges (edges used by exactly one face), as vertex index lists."""
    unique, counts = np.unique(mesh.edges_sorted, axis=0, return_counts=True)
    nbrs = {}
    for a, b in unique[counts == 1]:
        nbrs.setdefault(int(a), []).append(int(b))
        nbrs.setdefault(int(b), []).append(int(a))
    loops, seen = [], set()
    for start in nbrs:
        if start in seen:
            continue
        loop, prev, cur = [start], None, start
        seen.add(start)
        while True:
            options = [n for n in nbrs[cur] if n != prev]
            if not options:
                break
            nxt = options[0]
            if nxt == start:
                loops.append(loop)
                break
            if nxt in seen:
                break
            loop.append(nxt)
            seen.add(nxt)
            prev, cur = cur, nxt
    return loops


def cap_mesh(mesh):
    """Flat fan caps over every open end of a vessel, facing outward. Returns one cap mesh (or None)."""
    verts, faces = [], []
    tree = cKDTree(mesh.vertices)
    for loop in boundary_loops(mesh):
        if len(loop) < 3:
            continue
        ring = mesh.vertices[loop]
        c = ring.mean(axis=0)
        n = np.zeros(3)
        for i in range(len(ring)):                                            # Newell normal of the ring
            n += np.cross(ring[i] - c, ring[(i + 1) % len(ring)] - c)
        # the vessel body lies behind the cap: flip so the cap faces away from it
        near = mesh.vertices[tree.query(c, k=min(60, len(mesh.vertices)))[1]]
        flip = np.dot(n, near.mean(axis=0) - c) > 0
        base = len(verts)
        verts.extend(ring.tolist())
        verts.append(c.tolist())
        k = len(loop)
        for i in range(k):
            a, b = base + i, base + (i + 1) % k
            faces.append([b, a, base + k] if flip else [a, b, base + k])
    if not faces:
        return None
    return trimesh.Trimesh(np.array(verts), np.array(faces), process=False)


def trim(mesh, rule, heart_tree):
    kind, value = rule
    if kind in ("above", "below"):
        normal = np.array([0, -1.0, 0]) if kind == "above" else np.array([0, 1.0, 0])
        origin = np.array([0, value * MM, 0])
    else:
        v = mesh.vertices
        centre = v.mean(axis=0)
        axis = np.linalg.svd(v - centre)[2][0]
        t = (v - centre) @ axis
        near_end = t[np.argmin(heart_tree.query(v)[0])]
        direction = 1.0 if near_end < np.median(t) else -1.0                # from the heart outwards
        normal = -direction * axis                                           # keep the heart side
        origin = centre + axis * (near_end + direction * value * MM)
    # low-level slice (no shapely needed); the open end is capped later
    v, f = trimesh.intersections.slice_faces_plane(mesh.vertices, mesh.faces, plane_normal=normal, plane_origin=origin)[:2]
    out = trimesh.Trimesh(v, f)
    out.merge_vertices()
    return out


def inflate(mesh, mm):
    m = mesh.copy()
    m.vertices = m.vertices + m.vertex_normals * (mm * MM)
    return m


def main():
    parts = load_parts(SRC)
    chambers = trimesh.util.concatenate([parts[k] for k in GROUPS["ventricles"] + GROUPS["atria"]])
    heart_tree = cKDTree(chambers.vertices)

    for name, rule in TRIMS.items():
        parts[name] = trim(parts[name], rule, heart_tree)

    meshes, caps = {}, []
    for group, names in GROUPS.items():
        pieces = []
        for n in names:
            m = parts[n]
            if group in CORONARIES + ["LM"]:
                m = inflate(m, 0.7)
            pieces.append(m)
            if group not in ("ventricles", "atria"):
                cap = cap_mesh(m)
                if cap is not None:
                    # coronary and cardiac-vein ends keep the vessel's own colour; great vessels get lumen caps
                    (pieces if group in CORONARIES + ["LM", "veins"] else caps).append(cap)
        meshes[group] = trimesh.util.concatenate(pieces)
        if group not in ("ventricles", "atria"):
            meshes[group].merge_vertices()            # weld touching pieces so shading blends across seams
    meshes["caps"] = trimesh.util.concatenate(caps)

    # myocardium = ventricles + atria, with baked colour and territory
    ven, atr = meshes.pop("ventricles"), meshes.pop("atria")
    myo = trimesh.util.concatenate([ven, atr])
    is_atrium = np.r_[np.zeros(len(ven.vertices)), np.ones(len(atr.vertices))]
    v = myo.vertices
    srgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)]) / 255
    height = (v[:, 1] - v[:, 1].min()) / np.ptp(v[:, 1])
    col = srgb("#6a1823") + (srgb("#8a4152") - srgb("#6a1823")) * is_atrium[:, None]
    col = col * (0.82 + 0.18 * height)[:, None]
    myo.vertex_attributes["_tissue"] = np.clip(col, 0, 1).astype(np.float32)
    d = np.stack([cKDTree(meshes[k].vertices).query(v)[0] / MM for k in CORONARIES], axis=1)
    w = np.exp(-d / 14.0)
    w /= w.sum(axis=1, keepdims=True)
    w *= (1 - is_atrium)[:, None]
    myo.vertex_attributes["_territory"] = w.astype(np.float32)
    meshes = {"myocardium": myo, **meshes}

    # centre on the chambers and scale to 2.5 units tall
    lo, hi = chambers.bounds
    mid = (lo + hi) / 2
    scale = 2.5 / (hi[1] - lo[1])
    tf = trimesh.transformations.scale_matrix(scale) @ trimesh.transformations.translation_matrix(-mid)
    scene = trimesh.Scene()
    for name, m in meshes.items():
        m.apply_transform(tf)
        m.visual = trimesh.visual.ColorVisuals(m)
        scene.add_geometry(m, geom_name=name, node_name=name)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(scene.export(file_type="glb"))
    for name, m in meshes.items():
        print(f"{name:16s} {len(m.faces):6d} faces")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.2f} MB)")
    print(f"body midline in viewer units: x = {-mid[0] * scale:.3f}, z = {-mid[2] * scale:.3f}")


if __name__ == "__main__":
    main()
