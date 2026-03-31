import { useMutation } from "@tanstack/react-query";
import api from "@/api/client";

interface UploadFileResponse {
  url: string;
  key: string;
}

interface UploadFileParams {
  file: File;
  spaceId?: string;
  entityType?: string;
  entityId?: string;
}

export function useUploadFile() {
  return useMutation<UploadFileResponse, Error, UploadFileParams | File>({
    mutationFn: async (input) => {
      const formData = new FormData();

      if (input instanceof File) {
        formData.append("file", input);
      } else {
        formData.append("file", input.file);
        if (input.spaceId) formData.append("spaceId", input.spaceId);
        if (input.entityType) formData.append("entityType", input.entityType);
        if (input.entityId) formData.append("entityId", input.entityId);
      }

      const { data } = await api.post<UploadFileResponse>(
        "/files/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
}
