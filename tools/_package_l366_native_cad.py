"""Create immutable signed P3->P4 CAD handoff, without changing V57 assets.

Usage: python tools/_package_l366_native_cad.py <lab_root> <web_repo_root>
Refuses to overwrite a previous package. Verifies independently signed hashes,
source GLB and Blender, copies only existing measured CAD and QA, and ZIP-tests
the finished archive. No SolidWorks, Blender or web build is launched here.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DEST_NAME = "P3P4_L366_NATIVE_EDUCATIONAL_CAD_QA_20261102"
GLB_SHA = "73826d5cb777ed08cd9f20a9dd3171c1964f1f8de8c570edfb9f4a802538e306"
BLEND_SHA = "f2df63c3218bb6e260a4765c36c60d28de7347e0f824404462eae62af33e4f95"
STAGES = {
    "L357": "L357_CLOSED_WET_SCROLL_NATIVE_20261102",
    "L358": "L358_SOURCE_ANGLE_CORRECTION_NATIVE_20261102",
    "L360": "L360_EYE_TO_SCROLL_NATIVE_CUT_STUDY_20261102",
    "L361": "L361_SEALED_CENTER_EYE_AND_SCROLL_NATIVE_20261102",
    "L364": "L364_SHORT_WET_NECK_NATIVE_20261102",
    "L365": "L365_L361_TAIL_TO_B64_DISCHARGE_PREFLIGHT_20261102",
}
RECEIPTS = {
    "L357": "L357_SHA256_SIGNED_RECEIPT.json",
    "L358": "L358_FINAL_SHA256_RECEIPT.json",
    "L360": "L360_SHA256_SIGNED_RECEIPT.json",
    "L361": "L361_SHA256_SIGNED_RECEIPT.json",
    "L364": "L364_FINAL_SHA256_RECEIPT.json",
    "L365": "L365_SHA256_SIGNED_RECEIPT.json",
}
QA = {
    "L357": "L357_INDEPENDENT_CLOSED_HOLLOW_AND_FLOW_QA.json",
    "L358": "L358_INDEPENDENT_STEP_TRUE_SOURCE_ANGLE_AND_LUMEN_QA.json",
    "L360": "L360_INDEPENDENT_NATIVE_OPEN_EYE_PORT_QA.json",
    "L361": "L361_INDEPENDENT_TWO_PORT_CAD_QA.json",
    "L364": "L364_INDEPENDENT_NATIVE_ANNULUS_AND_SOURCE_STATIONS_QA.json",
    "L365": "L365_INDEPENDENT_TAIL_TO_DISCHARGE_PREFLIGHT_QA.json",
}
OTHER = {
    "L359": "L359_NATIVE_ADAPTER_SOURCE_BVH_20261102",
    "L362": "L362_OBLIQUE_SUCTION_BVH_VS_SOURCE_20261102",
    "L363": "L363_REAL_NATIVE_CANDIDATE_ASSEMBLY_BVH_20261102",
}


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for data in iter(lambda: f.read(1024 * 1024), b""):
            h.update(data)
    return h.hexdigest()


def need(test: bool, label: str):
    if not test:
        raise RuntimeError(f"L366_NO_GO_{label}")


def receipt_files(doc: dict):
    data = doc.get("files")
    if data is None:
        data = doc.get("isolated_L365_files")
    if data is None:
        data = doc.get("new_native_files")
    need(data is not None, "RECEIPT_SCHEMA")
    if isinstance(data, list):
        return {item["name"]: item for item in data}
    return data


def main(lab: Path, web: Path):
    lab, web = lab.resolve(), web.resolve()
    need(lab.is_dir() and lab.name == "lab_bernoulli_euler_20261031", "LAB_DIR")
    need(web.is_dir() and (web / ".git").exists(), "WEB_DIR")
    dest_root = lab / "deliverables"
    dest = dest_root / DEST_NAME
    archive = dest_root / (DEST_NAME + ".zip")
    need(not dest.exists() and not archive.exists(), "REFUSE_OVERWRITE_EXISTING_DELIVERABLE")

    glb = web / "public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb"
    blend = lab / (
        "bl_lab_sources/OUTPUT_L59_SEVEN_VISIBLE_COLLAR_AXIAL_ONLY_20261101/"
        "LAB_L59_SEVEN_TRUE_SW_NATIVE_COLLARS_ABOVE_DECK_CYCLONE05_NOGO.blend"
    )
    need(glb.is_file() and sha(glb) == GLB_SHA, "ORIGINAL_V57_SHA_MISMATCH")
    need(blend.is_file() and sha(blend) == BLEND_SHA, "ORIGINAL_L59_SHA_MISMATCH")

    signed_sources = {}
    pending = []
    for key, dirname in STAGES.items():
        folder = lab / "sw_lab_sources" / dirname
        receipt = folder / RECEIPTS[key]
        qa_path = folder / QA[key]
        need(receipt.is_file() and qa_path.is_file(), key + "_RECEIPT_OR_QA_MISSING")
        doc = json.loads(receipt.read_text("utf-8-sig"))
        expected = receipt_files(doc)
        qa = json.loads(qa_path.read_text("utf-8-sig"))
        status = str(qa.get("status", ""))
        if key == "L365":
            need("NO_GO" in status, "L365_NO_GO_NOT_RECORDED")
        else:
            need("PASS" in status, key + "_QA_NOT_PASS")
        verified_files = 0
        for filename, item in expected.items():
            source = folder / filename
            need(source.is_file(), f"{key}_MISSING_{filename}")
            need(source.stat().st_size == item["bytes"], f"{key}_SIZE_{filename}")
            need(sha(source) == item["sha256"].lower(), f"{key}_HASH_{filename}")
            verified_files += 1
        signed_sources[key] = {
            "status": status,
            "receipt_sha256": sha(receipt),
            "receipt_file_count_verified": verified_files,
        }
        # Include ALL source studies for reconstruction, but not duplicate data.
        for source in sorted(folder.iterdir()):
            if source.is_file():
                pending.append((source, Path("CAD_AND_QA") / key / source.name))

    for key, dirname in OTHER.items():
        folder = lab / "scope" / dirname
        need(folder.is_dir(), f"{key}_QA_DIR_MISSING")
        for source in sorted(folder.iterdir()):
            if source.is_file():
                pending.append((source, Path("SOURCE_BVH_AUDITS") / key / source.name))

    qa_web = web / "qa-artifacts/L356_P3P4_READONLY_GLTF_TOPOLOGY_QA.json"
    need(qa_web.is_file(), "L356_SOURCE_WEB_QA_NOT_PRESENT")
    pending.append((qa_web, Path("SOURCE_BVH_AUDITS/L356") / qa_web.name))
    signed_sources["V57"] = {"file": str(glb), "sha256": GLB_SHA, "original_unchanged": True}
    signed_sources["L59"] = {"file": str(blend), "sha256": BLEND_SHA, "original_unchanged": True}

    overview = """# PULPA LAB — Entrega P3→P4 L366 (2 noviembre 2026)

## Resultado verificable

**PASS — CAD educativo nativo SOLIDWORKS 2026, piezas aisladas:**
- L358: adaptador de succión, plano inclinado real ~1,157312°, lumen abierto.
- L364: cuello anular 144,997 mm, luz Ø0,84 m hipotética, luz abierta; estaciones alineadas con L358 y L361 (centro residual ~0,0044 mm).
- L361: cuerpo cerrado de voluta con ojo axial nominal Ø0,84 m, ventana radial a la espiral y salida tangencial libres. Se verificó un recorrido interior pedagógico por STEP/STL. L357 y L360 contienen etapas CAD nativas precedentes firmadas.

**NO-GO — conexión hidráulica del circuito original P3→P4:**
- La malla original SEG02, el hub y la descarga original conservan tapas sólidas. NO se sustituyeron en el BLEND/GLB.
- L358 + L364 + L361 tienen estaciones coincidentes a nivel hipotético, pero NO existe ensamblaje SLDASM, junta, brida, sello, espesor/ID industrial aprobado ni verificación de volumen húmedo único integrado.
- La salida tangencial L361 y la tubería vertical B64 están separadas 2,2638998 m. La tangente apunta lateralmente en dirección incompatible; cinco rutas cúbicas estudiadas chocan con el sólido L361. El diámetro interior original de descarga NO está documentado.
- L365 es una auditoría READ-ONLY de imposibilidad de certificación con las rutas probadas. No significa que cualquier nuevo trazado sea matemáticamente imposible.

**No declarar CFD, presión, capacidad de proceso, sensor real, sello validado ni continuidad con el V57 original.**

## Contenido

CAD_AND_QA: piezas SLDPRT / STEP / STL, programas de generación, ensayos independientes, SHA firmados.
SOURCE_BVH_AUDITS: verificaciones del modelo original y geometría candidata, incluido L365 NO-GO.
RELEASE_GATE.json: estados explícitos; SHA256_FILES.json: hashes de los archivos copiados.

Originales firmados (BLEND L59 / GLB V57) **no se copian ni modifican**. La producción web y el solver tampoco cambian. D5 se deja para el otro ordenador.
"""
    gate = {
        "block": "L366",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "release": "PASS_EDUCATIONAL_NATIVE_CAD__NO_GO_SOURCE_B64_HYDRAULIC_MATE",
        "genuine_sw2026_source_studies": ["L357", "L358", "L360", "L361", "L364"],
        "functional_native_educational_tandem": ["L358", "L364", "L361"],
        "fully_manifold_closed_material_and_open_lumen_studies": True,
        "one_unified_native_wet_BRep_from_original_V57": False,
        "source_SEG02_cap_removed": False,
        "source_hub_cap_removed": False,
        "source_discharge_cap_removed": False,
        "SLDASM_mates_and_pressure_seals_checked": False,
        "original_discharge_transition_feasible_verified": False,
        "discharge_true_ID_known": False,
        "solver_changed": False,
        "production_web_assets_changed": False,
        "signed_sources": signed_sources,
        "blockers": [
            "Source pump SEG02/hub/discharge caps still solid and original wet chamber missing",
            "Native pieces not physically mated into one certified assembly with seals",
            "L365 five tested discharge centerlines interfere with L361 and B64 discharge ID is N/D",
            "No hydraulic pressure, erosion-rate or CFD certification",
        ],
    }
    dest.mkdir(parents=True)
    copied = {}
    for source, relative in pending:
        target = dest / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        need(sha(target) == sha(source), f"COPY_MISMATCH_{relative}")
        copied[relative.as_posix()] = {"bytes": target.stat().st_size, "sha256": sha(target)}
    (dest / "README_ENTREGA.md").write_text(overview, encoding="utf-8")
    copied["README_ENTREGA.md"] = {
        "bytes": (dest / "README_ENTREGA.md").stat().st_size,
        "sha256": sha(dest / "README_ENTREGA.md"),
    }
    (dest / "RELEASE_GATE.json").write_text(json.dumps(gate, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    copied["RELEASE_GATE.json"] = {
        "bytes": (dest / "RELEASE_GATE.json").stat().st_size,
        "sha256": sha(dest / "RELEASE_GATE.json"),
    }
    (dest / "SHA256_FILES.json").write_text(json.dumps(copied, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")

    files = sorted(dest.rglob("*"))
    files = [f for f in files if f.is_file()]
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=7) as z:
        for f in files:
            z.write(f, arcname=(Path(DEST_NAME) / f.relative_to(dest)).as_posix())
    with zipfile.ZipFile(archive) as z:
        need(z.testzip() is None, "ZIP_CRC_FAILED")
        need(len(z.namelist()) == len(files), "ZIP_FILE_COUNT_MISMATCH")
    result = {
        "result": gate["release"],
        "package": str(archive),
        "archive_sha256": sha(archive),
        "archive_bytes": archive.stat().st_size,
        "files_in_zip": len(files),
        "verified_signed_file_counts": {key: val.get("receipt_file_count_verified") for key, val in signed_sources.items() if key in STAGES},
        "GLB_V57_original_sha256": GLB_SHA,
        "BLEND_L59_original_sha256": BLEND_SHA,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    need(len(sys.argv) == 3, "USAGE_LAB_ROOT_AND_WEB_REPO")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
