var mongoose = require("mongoose");

// Comments are written by iot_map_admin. This app only reads the ones an admin marked public.
var commentSchema = mongoose.Schema({
  entity: {
    type: { type: String },
    id: mongoose.Schema.Types.ObjectId,
    product_id: mongoose.Schema.Types.ObjectId
  },
  text: String,
  public: Boolean,
  created_at: Date
}, { collection: "comments" });

var Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
