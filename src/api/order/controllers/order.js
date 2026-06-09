'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        //@ts-ignore

        const { products } = ctx.request.body;

        try {
            const lineItems = await Promise.all(
                products.map(async (product) => {
                    const item = await strapi
                        .service('api::product.product')
                        .findOne(product.documentId);

                    return {
                        price_data: {
                            currency: 'mxn',
                            product_data: {
                                name: item.serviceName,
                            },
                            unit_amount: Math.round(item.price * 100)
                        },
                        quantity: 1
                    }
                })
            );

            const stripe = require('stripe')(process.env.STRIPE_KEY);

            const session = await stripe.checkout.sessions.create({
                shipping_address_collection: { allowed_countries: ['MX'] },
                payment_method_types: ['card'],
                mode: 'payment',
                success_url: process.env.CLIENT_URL + '/success',
                cancel_url: process.env.CLIENT_URL + '/cart',
                line_items: lineItems,
            });

            await strapi
                .service('api::order.order')
                .create({ data: { products, stripeId: session.id } });

            return { stripeSession: session };
        } catch (error) {
            console.log("ERROR DETALLADO:", error.message);
            return { error: error.message };
        }
    }
}));