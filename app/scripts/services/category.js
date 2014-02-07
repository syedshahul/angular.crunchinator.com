'use strict';

angular.module('crunchinatorApp.models').service('Category', function(Model, API_BASE_URL) {
    /**
     * Creates an instance of Category.
     *
     * @constructor
     * @this {Category}
     */
    var Category = function() {
        this.url = API_BASE_URL + '/categories.json';
    };

    Category.prototype = Object.create(Model);

    /**
     * A function called on the response object that returns the raw model data
     * This is overridden for each subclass of model for different paths to the data
     *
     * @override
     * @param {object} response The response returned from the API
     * @return {array} A list of categories extracted from the response
     */
    Category.prototype.parse = function(response) {
        return response.categories;
    };

    /**
     * This links companies and investors to the category object so that when filtering
     * by categories we have access to the companies and investors it contains
     *
     * @param {object} companiesById An object/hash of all companies keyed by their IDs
     * @param {object} investorsById An object/hash of all categories keyed by their IDs
     */
    Category.prototype.linkModels = function(companiesById, investorsById) {
        _.each(this.all, function(category){
            category.companies = [];
            category.investors = [];

            _.each(category.company_ids, function(companyId){
                category.companies.push(companiesById[companyId]);
            });

            _.each(category.investor_ids, function(investorId){
                category.investors.push(investorsById[investorId]);
            });

            category.companies = _.compact(category.companies);
            category.investors = _.compact(category.investors);
        });
    };

    /**
     * Sets up a crossfilter object on all of the model's data
     * Sets up a list of named dimensions used in the filter list to filter datasets
     */
    Category.prototype.setupDimensions = function() {
        var crossCategories = crossfilter(this.all);

        this.dimensions = {
            byId: crossCategories.dimension(function(category) { return category.id; }),
            byCompanies: crossCategories.dimension(function(category) { return category.company_ids; }),
            byInvestors: crossCategories.dimension(function(category) { return category.investor_ids; }),
            byTotalFunding: crossCategories.dimension(function(category) {
                return _.pluck(category.companies, 'total_funding');
            }),
            byFundingPerRound: crossCategories.dimension(function(category){
                return _.pluck(_.flatten(_.pluck(category.companies, 'funding_rounds')), 'raised_amount');
            }),
            byMostRecentFundingRound: crossCategories.dimension(function(category){
                return _.map(category.companies, function(company){
                    return _.max(company.funding_rounds, function(round){
                        return round.funded_on ? d3.time.format('%x').parse(round.funded_on) : 0;
                    }).raised_amount;
                });
            }),
            byStatuses: crossCategories.dimension(function(category) {
                return _.pluck(category.companies, 'status');
            })
        };

        this.byName = crossCategories.dimension(function(category) { return category.name; });
    };

    /**
     * A mapping of dataset names to the exclusions used when building the dataset
     * A dataset with a value of ['byId'] will have every filter applied except the one named 'byId'
     */
    Category.prototype.dataSets = {
        dataForCategoryList: ['byId']
    };

    /**
    * A list of functions that filter on a single dimension
    * When building datasets every filter is applied to that dataset except what's in the exclusion list
    * Adding a new filter here will apply the filter to every dataset unless its excluded
    */
    Category.prototype.filters = {
        byCompanies: function() {
            var ids = this.filterData.companyIds;
            this.dimensions.byCompanies.filter(function(companyIds) {
                return (ids.length === 0 || _.intersection(companyIds, ids).length > 0);
            });
        },
        byInvestors: function() {
            var ids = this.filterData.investorIds;
            this.dimensions.byInvestors.filter(function(investorIds) {
                return (ids.length === 0 || _.intersection(investorIds, ids).length > 0);
            });
        },
        byId: function() {
            var ids = this.filterData.categoryIds;
            this.dimensions.byId.filter(function(id) {
                return (ids.length === 0 || ids.indexOf(id) > -1);
            });
        },
        byTotalFunding: function() {
            var self = this;
            var range = this.filterData.ranges;
            this.dimensions.byTotalFunding.filter(function(company_funding) {
                return self.fallsWithinRange(company_funding, range);
            });
        },
        byFundingPerRound: function() {
            var self = this;
            var range = this.filterData.ranges;
            this.dimensions.byFundingPerRound.filter(function(company_funding) {
                return self.fallsWithinRange(company_funding, range);
            });
        },
        byMostRecentFundingRound: function() {
            var self = this;
            var range = this.filterData.mostRecentRoundRanges;
            this.dimensions.byMostRecentFundingRound.filter(function(company_funding) {
                return self.fallsWithinRange(company_funding, range);
            });
        },
        byStatus: function() {
            var statuses = this.filterData.statuses;
            this.dimensions.byStatuses.filter(function(company_statuses) {
                if(statuses.length === 0) { return true; }

                for(var i = 0; i < company_statuses.length; i++) {
                    var company_status = company_statuses[i];
                    if(_.contains(statuses, company_status)) {
                        return true;
                    }
                }
                return false;
            });
        }
    };

    return new Category();
});