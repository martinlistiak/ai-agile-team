import { useMutation } from "@tanstack/react-query";
import api from "@/api/client";

interface UploadFileResponse {
  url: string;
  key: string;
}

export function useUploadFile() {
  return useMutation<UploadFileResponse, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<UploadFileResponse>(
        "/files/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
}
