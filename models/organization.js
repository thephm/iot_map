var mongoose = require("mongoose");

var organizationSchema = mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  url: String,
  date_added: Date,
  description: String,
  history: {
    founded_year: Number,
    acquired_year: Number,
    acquired_by: String,
    died_year: Number,
    founder: [{
      name: String,
      url: String
    }]
  },
  stock: {
    exchange: String,
    ticker_symbol: String,
    url: String
  },
  social_network: [{
    service: String,
    account: String,
    url: String
  }],
  post: [{
    service: String,
    url: String,
    date: Date
  }],
  location: [{
    head_office: Boolean,
    phone: String,
    email: String,
    address: {
      street: String,
      suite: String,
      city: String,
      state_province: String,
      country: String,
      zip_postal: String,
      lat: Number,
      lng: Number,
    }
  }],
  product: [{
    name: { type: String },
    slug: { type: String, unique: true },
    url: String,
    primary_category: { type: String },
    secondary_category: { type: String },
    description: String,
    software: Boolean,
    hardware: Boolean,
    service: Boolean,
    open_source: Boolean,
    open_source_license: String,
    github_url: String,
    wired_interface: Array,
    wireless_interface: Array,
    wifi_chip: Array,
    location: Array,
    application: Array,
    encryption: Array,
    authentication: Array,
    protocol: Array,
    standard: Array,
    notification: Array,
    feature: Array,
    software_language: Array,
    operating_system: Array,
    hardware_platform: [{
      _id: { type: String },
      name: String,
      slug: { type: String, unique: true },
    }],
    integration: [{
      _id: { type: String },
      name: { type: String },
      type: { type: String },
      slug: { type: String, unique: true },
    }]
  }]
});

organizationSchema.methods.getUrl = function() {
  url = this.url;
  if (!url.startsWith('http')) { url = 'http://' + url; }
  return url;
};

organizationSchema.methods.checkUrl = function(url) {
  if (!url.startsWith('http')) { url = 'http://' + url; }
  return url;
};

organizationSchema.methods.getFirstLocation = function() {
  address = "";
  if (this.location[ 0 ]) {
    location = this.location[ 0 ];

    if (location.address.street) { address = location.address.street; }

    if (location.address.suite) {
      address = address ? address += ' ' : address;
      address += location.address.suite;
    }

    if (location.address.city) {
      address = address ? address += ', ' : address;
      address += location.address.city;
    }

    if (location.address.state_province) {
      address = address ? address += ', ' : address;
      address += location.address.state_province;
    }

    if (location.address.country) {
      address = address ? address += ', ' : address;
      address += location.address.country;
    }

    if (location.address.zip_postal) {
      address = address ? address += ' ' : address;
      address += location.address.zip_postal;
    }

  }
  return address;
};

organizationSchema.methods.getDateAdded = function() {
  dateStr = "";
  if (this.date_added) {
    dateStr = this.formatDate(this.date_added);
  }
  return dateStr;
};

organizationSchema.methods.formatDate = function(date) {
  if (date) {
    dateStr = date.toISOString().substr(0, 10);
  }
  return dateStr;
};

organizationSchema.methods.getPhone = function() {
  phoneStr = "";
  if (this.location[ 0 ]) {
    location = this.location[ 0 ];
    phoneStr = location.phone;
  }
  return phoneStr;
};

organizationSchema.methods.getEmail = function() {
  email = "";
  if (this.location[ 0 ] && this.location[ 0 ].email) {
    email = this.location[ 0 ].email;
  }
  return email;
};

var Organization = mongoose.model("Organization", organizationSchema);

module.exports = Organization;
