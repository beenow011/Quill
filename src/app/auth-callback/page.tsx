import { useRouter, useSearchParams } from "next/navigation"
import { trpc } from "../_trpc/client"


const Page = async () => {
    const router = useRouter()

    const searchParams = useSearchParams()
    const origin = searchParams.get('origin')


    trpc.authCallback.useQuery(undefined, {
        onSuccess: ({ data }) => {
            const { success } = data;
            if (success) {
                router.push(origin ? `/${origin}` : '/dashboard');
            }
        },
    });

}

export default Page