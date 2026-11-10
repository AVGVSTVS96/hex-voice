import Constants from "expo-constants";
import { File, UploadType } from "expo-file-system";
import { fetch } from "expo/fetch";
import * as z from "zod/mini";

import { createHex } from "./api";
import { createClient } from "./client";

const Setting = z.optional(z.string());

export const hex = createHex(
  createClient({
    fetch,
    sendFile: async (url, { uri, type }, { headers, signal }) => {
      const { status, body } = await new File(uri).upload(url, {
        uploadType: UploadType.BINARY_CONTENT,
        mimeType: type,
        headers,
        sessionType: "foreground",
        signal,
      });

      return { status, text: body };
    },
    url: Setting.parse(process.env.EXPO_PUBLIC_HEX_URL),
    token: Setting.parse(process.env.EXPO_PUBLIC_HEX_TOKEN),
  }),
);

export const LinkBuild = z.object({
  version: z.number(),
  runtime: z.optional(z.string()),
  install: z.optional(z.string()),
});

export type LinkBuild = z.infer<typeof LinkBuild>;

const updates = createClient({
  fetch,
  url: Constants.expoConfig?.updates?.url?.replace(/\/manifest$/u, ""),
});

export const installLink = {
  watch: async (after: number | undefined, signal: AbortSignal) =>
    await updates.request("/install/latest.json", LinkBuild, { after, signal }),
};
