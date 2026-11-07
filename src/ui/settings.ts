import { UserData } from "../types";

export function initSettings({ getUserData, onImport, onExport }:{
    getUserData: () => UserData;
    onImport: (file: File) => void;
    onExport: () => string;
}) {
    const overlay = document.getElementById("settings-overlay")!;

    function open() {
        const data = getUserData();
        document.getElementById("watched-count")!.textContent = `Watched: ${data.watched.length} films`;
        document.getElementById("watchlist-count")!.textContent = `Watchlist: ${data.watchlist.length} films`;
        overlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    function close() {
        overlay.classList.add("hidden");
        document.body.style.overflow = "";
    }

    document.getElementById("settings-btn")!.addEventListener("click", open);
    document.getElementById("settings-close")!.addEventListener("click", close);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });
    document.getElementById("export-btn")!.addEventListener("click", () => {
        const blob = new Blob([onExport()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "what2watch_personal_data.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    });
    document.getElementById("import-btn")!.addEventListener("click", () => {
        document.getElementById("import-input")!.click();
    });
    document.getElementById("import-input")!.addEventListener("change", event => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) onImport(file);
        target.value = "";
    });

    return { open, close, isOpen: () => !overlay.classList.contains("hidden") };
}
