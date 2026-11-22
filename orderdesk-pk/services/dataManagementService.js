export function downloadDataFile(path) {
  const link = document.createElement("a");
  link.href = `/api/${path.replace(/^\/+/, "")}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const getErrorMessage = async (response) => {
  const data = await response.json().catch(() => ({}));
  return data.message || "The request could not be completed.";
};

export async function uploadBackupFile(path, file) {
  const formData = new FormData();
  formData.append("backup", file);
  const response = await fetch(`/api/${path.replace(/^\/+/, "")}`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json();
}
