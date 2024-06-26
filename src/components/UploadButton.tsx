
"use client";

// import { Dialog } from "@radix-ui/react-dialog";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import DropZone from 'react-dropzone'
import { Cloud, File, Loader2 } from "lucide-react";
import { Progress } from "./ui/progress";
// import { useUploadThing } from "@/utils/uploadthing";
import { useToast } from "./ui/use-toast";
import { trpc } from "@/app/_trpc/client";
import { useRouter } from "next/navigation";
import { useEdgeStore } from "@/lib/edgestore";
import { v4 as uuid } from 'uuid'
// import { Upload } from "@/lib/uploadThing";


const UploadZone = ({ isSubscribed }: { isSubscribed: boolean }) => {



    const router = useRouter()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [key, setKey] = useState<string | undefined>()
    const { toast } = useToast();
    // const { startUpload } = useUploadThing(isSubscribed ? 'proPlanUploader' : 'freePlanUploader')
    const { edgestore } = useEdgeStore();
    const { mutate: uploadToEdge } = trpc.uploadToEdgerStore.useMutation()
    const { mutate: startPolling } = trpc.getFile.useMutation({
        onSuccess: (file) => {
            router.push(`/dashboard/${file.id}`)
        },
        onError: () => {
            router.push(`/dashboard`)
        },
        retry: true,
        retryDelay: 500
    })

    const startSimulatedProgress = () => {
        setUploadProgress(0)
        const interval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 95) {
                    clearInterval(interval)
                    return prev
                } else {
                    return prev + 5
                }
            })
        }, 500)
        return interval;
    }
    return (
        <DropZone multiple={false} onDrop={async (acceptedFiles) => {
            setIsUploading(true)
            const id = uuid()
            setKey(id)
            const progressInterval = startSimulatedProgress()
            // console.log(acceptedFiles)
            const res = await edgestore.publicFiles.upload({
                file: acceptedFiles[0],
                onProgressChange: (progress) => {
                    // you can use this to show a progress bar
                    if (progress === 100) {
                        clearInterval(progressInterval)
                    }
                    // console.log(progress);
                },

            });
            // console.log(res)
            if (!res) {
                return toast({
                    title: "Something went wrong",
                    description: "Please try again",
                    variant: "destructive"
                })
            }
            uploadToEdge({ url: res.url, key: id, name: acceptedFiles[0].name, isSubscribed })

            // const [fileResponse] = res;
            // const key = fileResponse?.key
            // if (!key) {
            //     return toast({
            //         title: "Something went wrong",
            //         description: "Please try again",
            //         variant: "destructive"
            //     })
            // }

            // 
            setUploadProgress(100)
            startPolling({ url: res.url })
        }}>
            {({ getRootProps, getInputProps, acceptedFiles }) => (
                <div {...getRootProps()} className="border h-64 m-4 border-dashed border-gray-300 rounded-lg">
                    <div className="flex items-center justify-center h-full w-full">
                        <input
                            {...getInputProps()}
                            type='file'
                            id='dropzone-file'
                            className='hidden'
                        />
                        <label htmlFor="dropZone-file" className="flex flex-col items-center justify-center w-full h-full rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Cloud className="h-6 w-6 text-zinc-500 mb-2" />
                                <p className="mb-2 text-sm text-zinc-700">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-sm text-zinc-500">PDF (up to {isSubscribed ? '16' : '4'}MB)</p>
                            </div>
                            {acceptedFiles && acceptedFiles[0] && (
                                <div className="max-w-xs bg-white flex items-center rounded-md overflow-hidden outline outline-[1px] outline-zinc-200 divide-x divide-zinc-200">
                                    <div className="px-3 py-2 h-full grid place-items-center">
                                        <File className='h-4 w-4 text-blue-500' />
                                    </div>
                                    <div className="px-3 py-2 h-full text-sm truncate">{acceptedFiles[0].name}</div>
                                </div>
                            )}
                            {
                                isUploading && (
                                    <div className="w-full mt-4 max-w-xs mx-auto">
                                        <Progress value={uploadProgress}
                                            indicatorColor={uploadProgress === 100 ? 'bg-green-500' : ''}
                                            className="h-1 w-full bg-zinc-200" />
                                        {uploadProgress === 100 ? (
                                            <div className="flex gap-1 items-center justify-center text-sm text-zinc-700 text-center pt-2">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Redirecting...
                                            </div>
                                        ) : null}
                                    </div>
                                )
                            }

                        </label>
                    </div>

                </div>
            )}
        </DropZone>)
}
const UploadButton = ({ isSubscribed }: { isSubscribed: boolean }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    return (
        <Dialog open={isOpen} onOpenChange={(v) => { !v && setIsOpen(v) }}>
            <DialogTrigger onClick={() => setIsOpen(true)} asChild><Button> Upload PDF</Button></DialogTrigger>
            <DialogContent>
                <UploadZone isSubscribed={isSubscribed} />

            </DialogContent>
        </Dialog>
    )
}

export default UploadButton;