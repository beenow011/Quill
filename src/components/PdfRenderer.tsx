'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useToast } from './ui/use-toast';
import { useResizeDetector } from 'react-resize-detector'
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';
import { useForm } from 'react-hook-form'
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`

interface PdfRendererProps {
    url: string
}

const PdfRenderer = ({ url }: PdfRendererProps) => {

    const [numPages, setNumPages] = useState<number>()
    const [currPage, setCurrPage] = useState(1)
    const { toast } = useToast();
    const { width, ref } = useResizeDetector()

    const customPageValidator = z.object({
        page: z.string().refine((num) => Number(num) > 0 && Number(num) <= numPages!)
    })
    type TCustomPageValidator = z.infer<typeof customPageValidator>
    const { register, handleSubmit, formState: { errors }, setValue } = useForm<TCustomPageValidator>({
        defaultValues: {
            page: '1'
        },
        resolver: zodResolver(customPageValidator)


    })

    const handlePageSubmit = ({ page }: TCustomPageValidator) => {
        setCurrPage(Number(page))
        setValue("page", String(page))
    }

    return (<div className="w-full bg-white rounded-md shadow flex 
     flex-col items-center">
        <div className="h-14 w-full border-b border-zinc-200 flex items-center justify-between px-2">
            <div className="flex items-center gap-1.5">
                <Button variant='ghost' disabled={currPage <= 1} aria-label='previous page' onClick={() => {
                    setCurrPage(prev => prev - 1 > 1 ? prev - 1 : 1)
                    setValue("page", String(currPage - 1 > 1 ? currPage - 1 : 1))
                }}>
                    <ChevronDown className='h-4 w-4' />
                </Button>
                <div className='flex items-center gap-1.5'>
                    <Input className={cn('w-12 h-8', errors.page && 'focus-visible:ring-red-500')} {...register('page')}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                handleSubmit(handlePageSubmit)()
                            }
                        }}
                    />
                    <p className='text-zinc-700 text-sm space-x-1'>
                        <span>/</span>
                        <span>{numPages ?? 'x'}</span>
                    </p>
                </div>
                <Button variant='ghost' disabled={numPages === undefined || currPage === numPages} aria-label='next page' onClick={() => {
                    setCurrPage(prev => prev + 1 < numPages! ? prev + 1 : numPages!)
                    setValue("page", String(currPage + 1 < numPages! ? currPage + 1 : numPages!))
                }} >
                    <ChevronUp className='h-4 w-4' />
                </Button>
            </div>
            <div></div>
        </div>
        <div className="flex-1 w-full max-h-screen ">
            <div ref={ref}>
                <Document loading={
                    <div className='flex justify-center'>
                        <Loader2 className='my-24 h-6 w-6 animate-spin' />
                    </div>
                }
                    onLoadError={() => {
                        toast({
                            title: 'Error loading PDF!',
                            description: 'Please try again',
                            variant: 'destructive'
                        })
                    }}
                    onLoadSuccess={({ numPages }) => {
                        setNumPages(numPages)
                    }}
                    file={url} className='max-h-full'>
                    <Page pageNumber={currPage} width={width ? width : 1} />

                </Document>
            </div>
        </div >
    </div >)
}
export default PdfRenderer 