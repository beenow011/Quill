import { OurFileRouter } from "@/app/api/uploadThing/core";
import { generateReactHelpers } from "@uploadthing/react";
 
 
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>();