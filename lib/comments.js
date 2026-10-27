var Comment = require('../models/comment');

// Only text and date leave the database: never the author, and never private comments.
function publicShape(comment) {
    var date = comment.created_at instanceof Date && !Number.isNaN(comment.created_at.getTime())
        ? comment.created_at.toISOString().slice(0, 10) : '';
    return { text: typeof comment.text === 'string' ? comment.text : '', date: date };
}

function query(filter) {
    return Comment.find({ ...filter, public: true })
        .select('text created_at entity.product_id').sort({ created_at: -1, _id: -1 }).lean().exec();
}

async function forEntity(type, id) {
    return (await query({ 'entity.type': type, 'entity.id': id })).map(publicShape)
        .filter(function (comment) { return comment.text; });
}

/** Public comments on an organization's products, keyed by product ID. */
async function forProducts(organizationId) {
    var byProduct = {};
    (await query({ 'entity.type': 'product', 'entity.id': organizationId })).forEach(function (comment) {
        var key = comment.entity && comment.entity.product_id ? String(comment.entity.product_id) : '';
        var shaped = publicShape(comment);
        if (key && shaped.text) { (byProduct[key] = byProduct[key] || []).push(shaped); }
    });
    return byProduct;
}

module.exports = { forEntity: forEntity, forProducts: forProducts, publicShape: publicShape };
