import { generateReactHelpers } from "@uploadthing/react/hooks";
 
import type { OurFileRouterType } from "@/app/api/uploadthing/core.ts";
 
export const { useUploadThing } =
  generateReactHelpers<OurFileRouterType>();