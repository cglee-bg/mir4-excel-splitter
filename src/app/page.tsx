"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function Home() {
  const [mode, setMode] = useState<"dialogue" | "master">("dialogue");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const zipRef = useRef<JSZip | null>(null);

  const langList = ["EN", "CT", "CS", "JA", "TH", "ES-LATAM", "PT-BR"];

  const processFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setMessage("");
      setCompleted(false);
      setProgress(0);
      zipRef.current = null;
    setLoading(true);
    setMessage("");
    setCompleted(false);
    setProgress(0);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    if (!json.length) {
      setMessage("❌ 시트에 데이터가 없습니다.");
      setLoading(false);
      return;
    }
    const headers = json[0];
    const zip = new JSZip();
    zipRef.current = zip;

    const baseName = file.name.split(".")[0];
    const prefix = baseName.split("_")[0];

    for (let i = 0; i < langList.length; i++) {
      const lang = langList[i];
      const wb = XLSX.utils.book_new();
      const keepCols: number[] = [];

      const commonCols =
        mode === "dialogue"
          ? [...range(0, 7), headers.length - 1]
          : [...range(0, 5), 13, 14];

      keepCols.push(...commonCols);

      if (mode === "dialogue") {
        const m = headers.indexOf(`${lang} (M)`);
        const f = headers.indexOf(`${lang} (F)`);
        if (m === -1 || f === -1) continue;
        keepCols.push(m, f);
      } else {
        const idx = headers.indexOf(lang);
        if (idx === -1) continue;
        keepCols.push(idx);
      }

      const extracted = json.map((row) => keepCols.map((i) => row[i] ?? ""));
      const newSheet = XLSX.utils.aoa_to_sheet(extracted);
      XLSX.utils.book_append_sheet(wb, newSheet, "Sheet1");
      const out = XLSX.write(wb, {
        type: "array",
        bookType: "xlsx",
        compression: true
      });

      const suffix = mode === "dialogue" ? "MIR4_MASTER_DIALOGUE" : "MIR4_MASTER_STRING";
      const filename = `${prefix}_${suffix}_${lang.replace("-", "")}.xlsx`;
      zip.file(filename, out);

      setProgress(Math.round(((i + 1) / langList.length) * 100));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setMessage("✅ 분리 완료. 아래에서 다운로드하세요.");
    setLoading(false);
    setCompleted(true);
    } catch (err) {
      console.error(err);
      setMessage("❌ 처리 중 오류가 발생했습니다. 파일을 확인해주세요.");
      setLoading(false);
    }
  }, [mode]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (loading) {
      alert("🚨 현재 파일 처리 중입니다. 새 파일을 선택하면 이전 작업이 중단됩니다.");
    }
    if (file) await processFile(file);
  };

  const handleDownload = async () => {
    if (zipRef.current) {
      const blob = await zipRef.current.generateAsync({ type: "blob" });
      saveAs(blob, `MIR4_${mode === "dialogue" ? "Dialogue" : "Master"}_Split.zip`);
    }
  };

  

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-black text-green-400 font-mono p-6 backdrop-blur"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="border-4 border-green-400 p-6 md:p-10 w-full max-w-xl bg-black/80 rounded-lg shadow-lg space-y-4">
        <h1 className="text-2xl md:text-3xl font-pixel text-center">🧙 MIR4 Excel Splitter</h1>

        <div className="flex justify-center gap-6 text-sm md:text-base">
          <p className="text-xs text-green-500 text-center mt-1">
            {mode === "dialogue"
              ? "언어별 (M)/(F) 두 열을 포함하여 추출합니다."
              : "언어 단일 열을 기준으로 추출합니다."}
          </p>
          <label className="cursor-pointer">
            <input
              type="radio"
              className="mr-2"
              checked={mode === "dialogue"}
              onChange={() => setMode("dialogue")}
            />
            Dialogue
          </label>
          <label className="cursor-pointer">
            <input
              type="radio"
              className="mr-2"
              checked={mode === "master"}
              onChange={() => setMode("master")}
            />
            Master
          </label>
        </div>

        <div className="text-center text-sm text-green-300">
          <p className="mb-2">📂 파일 선택 또는 아래에 드래그 앤 드롭하세요</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              if (e.target.files?.[0]) processFile(e.target.files[0]);
            }}
            className="mx-auto block text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-green-500 file:text-black hover:file:bg-green-400"
          />
        </div>

        {loading && (
          <div className="text-center text-yellow-300 animate-pulse">
            <p className="mb-2">⏳ 처리 중입니다... {progress}%</p>
            <div className="w-full h-3 bg-green-900 rounded overflow-hidden">
              <div
                className="h-full bg-green-400 animate-pulse"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {message && (
          <p className="text-green-300 text-center text-sm">
            {message} {completed && <span className="animate-bounce">🎉</span>}
          </p>
        )}

        {!loading && zipRef.current && (
          <div className="text-center">
            <button
              onClick={handleDownload}
              className="mt-2 px-5 py-2 bg-green-500 text-black rounded hover:bg-green-400 font-pixel text-sm"
            >
              📦 ZIP 다운로드
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
