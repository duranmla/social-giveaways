const { AuthenticationError } = require('apollo-server')
const _ = require('lodash')
const { Campaign } = require('../models/Campaign')
const { User } = require('../models/User')
const { UserAction } = require('../models/UserAction')
const UserActions = require('../resolvers/UserActions')
const { setContext } = require('./context')

const queryResolvers = {
  /**
   * Retieve the campaign scoped for further requests
   */
  currentCampaign: async (root, args, context) => {
    return context.Campaign
  },
  /**
   * Retrive user using Cookies
   */
  currentUser: async (root, args, context) => {
    if (!context.User.external_id) {
      throw new AuthenticationError('No user logged in')
    }

    return context.User
  },
  /**
   * Retrieve all the campaigns alongside its actions
   */
  campaigns: async () => {
    const campaigns = await Campaign.query().eager('actions')
    return campaigns
  },
  /**
   * Retrive the actions for a given user and campaign
   */
  userCampaignsActions: async (root, args) => {
    const { campaignId, userId } = args

    const result = await User.query()
      .findById(userId)
      .joinEager('campaigns.actions')
      .where('campaigns.id', campaignId)
    // TODO: we need to avoid to retrieve an array since we look for id
    const campaignActions = result.campaigns[0].actions

    return campaignActions
  }
}

const mutationResolvers = {
  /**
   * Updates a record of UserAction to completed or not
   */
  userActionUpdate: async (root, { userActionId, completed }) => {
    const userAction = await UserAction.query().patchAndFetchById(
      userActionId,
      {
        completed
      }
    )

    return userAction
  },
  addUserToCampaign: async (root, { motive }, context) => {
    const { id } = context.User
    const campaign = context.Campaign
    // NOTE: we need to fetch the user again cause context doesn't have the full tree
    const user = await User.query()
      .findById(id)
      .joinEager('campaigns')

    if (user.campaigns && user.campaigns.length) {
      return { ok: false }
    }

    await user.$relatedQuery('campaigns').relate({
      ...campaign,
      data: { motive }
    })

    return { ok: true }
  }
}

const allQueryResolvers = _.merge(queryResolvers, UserActions.Query)
const allMutationResolvers = _.merge(mutationResolvers, UserActions.Mutation)

module.exports = {
  setContext,
  queryResolvers: allQueryResolvers,
  mutationResolvers: allMutationResolvers
}
