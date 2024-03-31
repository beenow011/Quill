import { generateReactHelpers } from "@uploadthing/react/hooks";
 
import type { OurFileRouterType } from "@/app/api/uploadthing/core";
 
export const { useUploadThing } =
  generateReactHelpers<OurFileRouterType>();