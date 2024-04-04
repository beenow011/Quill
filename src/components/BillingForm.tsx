'use client';

import { getUserSubscriptionPlan } from "@/lib/stripe";
import { useToast } from "./ui/use-toast";
import { trpc } from "@/app/_trpc/client";
import MaxWidthWrapper from "./MaxWidthWrapper";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";


interface BillingtFormProps {
    subscribtionPlan: Awaited<ReturnType<typeof getUserSubscriptionPlan>>
}
const BillingForm = ({ subscribtionPlan }: BillingtFormProps) => {
    const { toast } = useToast()
    console.log("inside billing")
    const { mutate: createStripeSession, isLoading } = trpc.createStripeSession.useMutation({
        onSuccess: ({ url }: { url: string | null }) => {
            if (url) window.location.href = url
            console.log(url)
            if (!url) {
                toast({
                    title: "there was a problem...",
                    description: 'Please try this later!',
                    variant: 'destructive'
                })
            }
        }
    })
    return <MaxWidthWrapper className="max-w-5xl">
        <form className='mt-12' onSubmit={(e) => {
            e.preventDefault()
            createStripeSession()
        }}>
            <Card >
                <CardHeader>
                    <CardTitle>
                        Subscription Plan
                    </CardTitle>
                    <CardDescription>
                        You are currently on the <strong>{subscribtionPlan.name} plan.</strong>
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0 ">
                    <Button type="submit">
                        {isLoading ? (
                            <Loader2 className="mr-4 h-4 w-4 animate-spin" />
                        ) : null}
                        {
                            subscribtionPlan.isSubscribed ? "Manage Subscription" : "Upgrade to PRO"
                        }
                    </Button>
                    {
                        subscribtionPlan.isSubscribed ? (
                            <p className="rounded-full text-xs font-medium">
                                {subscribtionPlan.isCanceled ? "Your plan will be canceled on" : "Your plan renews on"} {format(subscribtionPlan.stripeCurrentPeriodEnd!, "dd.MM.yyyy")}
                            </p>
                        ) : null
                    }
                </CardFooter>
            </Card>
        </form>
    </MaxWidthWrapper>
}

export default BillingForm