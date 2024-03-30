import { Plans } from '@/config/stripe'
import { db } from '@/db'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  
  typescript: true,
})

export async function getUserSubscriptionPlan() {
  const { getUser } = getKindeServerSession()
  const user =await getUser()

  if (!user?.id) {
    return {
      ...Plans[0],
      isSubscribed: false,
      isCanceled: false,
      stripeCurrentPeriodEnd: null,
    }
  }

  const dbUser = await db.user.findFirst({
    where: {
      id: user.id,
    },
  })

  if (!dbUser) {
    return {
      ...Plans[0],
      isSubscribed: false,
      isCanceled: false,
      stripeCurrentPeriodEnd: null,
    }
  }

  const isSubscribed = Boolean(
    dbUser.stripePriceId &&
      dbUser.dtripeCurrentPeriodEnd && // 86400000 = 1 day
      dbUser.dtripeCurrentPeriodEnd.getTime() + 86_400_000 > Date.now()
  )

  const plan = isSubscribed
    ? Plans.find((plan) => plan.price.priceIds.test === dbUser.stripePriceId)
    : null

  let isCanceled = false
  if (isSubscribed && dbUser.stripeSubscriptionId) {
    const stripePlan = await stripe.subscriptions.retrieve(
      dbUser.stripeSubscriptionId
    )
    isCanceled = stripePlan.cancel_at_period_end
  }

  return {
    ...plan,
    stripeSubscriptionId: dbUser.stripeSubscriptionId,
    stripeCurrentPeriodEnd: dbUser.dtripeCurrentPeriodEnd,
    stripeCustomerId: dbUser.stripeCustomerId,
    isSubscribed,
    isCanceled,
  }
}