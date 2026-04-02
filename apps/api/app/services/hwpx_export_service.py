from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from zipfile import ZipFile
import xml.etree.ElementTree as ET


def _local_name(tag: str) -> str:
    if tag.startswith("{") and "}" in tag:
        return tag.split("}", 1)[1]
    return tag


class HWPXExportService:
    def __init__(self, *, template_path: str) -> None:
        self._template_path = Path(template_path)

    def export(self, *, filename: str, draft_text: str) -> tuple[str, bytes]:
        if not self._template_path.exists():
            raise FileNotFoundError(f"HWPX template not found: {self._template_path}")

        with ZipFile(self._template_path, "r") as source:
            infos = source.infolist()
            data_by_name = {info.filename: source.read(info.filename) for info in infos}

        section_files = sorted(
            name
            for name in data_by_name
            if name.startswith("Contents/section") and name.endswith(".xml")
        )
        if not section_files:
            raise ValueError("Template did not contain any section XML files.")

        lines = draft_text.splitlines()
        line_index = 0

        for section_file in section_files:
            root = ET.fromstring(data_by_name[section_file])
            text_nodes = [
                node
                for node in root.iter()
                if _local_name(node.tag).strip().lower() in {"t", "text"}
            ]
            for node in text_nodes:
                node.text = lines[line_index] if line_index < len(lines) else ""
                line_index += 1
            data_by_name[section_file] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

        if line_index < len(lines):
            raise ValueError("Template does not contain enough text nodes for the generated draft.")

        if "Preview/PrvText.txt" in data_by_name:
            data_by_name["Preview/PrvText.txt"] = (draft_text.strip() + "\n").encode("utf-8")

        output = BytesIO()
        with ZipFile(output, "w") as archive:
            for info in infos:
                archive.writestr(info, data_by_name[info.filename])

        return filename, output.getvalue()

    @staticmethod
    def build_content_disposition(filename: str) -> str:
        return f"attachment; filename*=UTF-8''{quote(filename)}"
