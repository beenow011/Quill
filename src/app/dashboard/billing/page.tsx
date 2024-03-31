import BillingForm from "@/components/BillingForm"
import { getUserSubscriptionPlan } from "@/lib/stripe"

const Page = async () => {

    const subscribtionPlan = await getUserSubscriptionPlan()

    return <BillingForm subscribtionPlan={subscribtionPlan} />
}

export default Page