const Knex = require("knex");
const knexConfig = require("../../knexfile");
const { Model } = require("objection");

const { Action } = require("../../models/Action");
const { Campaign } = require("../../models/Campaign");
const { User } = require("../../models/User");
const { UserAction } = require("../../models/UserAction");
const { createActions, createCampaign, createUser } = require("../stubs");

/**
 * In order to being able to run this you have to
 *  1. create a psql database called as `knexfile.testing` suggests
 *  2. npx knex migrate:latest --env="testing"
 *
 * NOTE: by running `yarn test` it should do the trick but you need for the very first
 * time to create the database yourself
 */

const knex = Knex(knexConfig.testing);
Model.knex(knex);

beforeAll(async () => {
	await User.query().delete();
	await Action.query().delete();
	await Campaign.query().delete();
});

describe("model structure", () => {
	it("allows to insert actions into campaigns", async () => {
		const campaign = await Campaign.query().insert(createCampaign());
		const actions = await campaign
			.$relatedQuery("actions")
			.insert(createActions());

		expect(campaign.id).toBeTruthy();
		expect(actions).toHaveLength(2);
	});

	it("allows to insert campaigns into a users", async () => {
		const user = await User.query().insert(createUser());
		const campaign = await user
			.$relatedQuery("campaigns")
			.insert(createCampaign());

		const createdUser = await User.query()
			.findById(user.id)
			.joinEager("campaigns");
		const createdCampaign = await Campaign.query().findById(campaign.id);

		expect(createdUser.id).toBeTruthy();
		expect(createdCampaign.id).toBeTruthy();
		expect(campaign.id).toBeTruthy();
		expect(createdUser.campaigns).toEqual([createdCampaign]);
	});

	it("allows to query actions by user", async () => {
		// Prepare data
		const user = await User.query().insert(createUser());
		const campaign = await user
			.$relatedQuery("campaigns")
			.insert(createCampaign());
		await campaign.$relatedQuery("actions").insert(createActions());

		// Pretend we need to find the just created user
		const createdUser = await User.query()
			.findById(user.id)
			.joinEager("campaigns.actions");
		const userCampaign = createdUser.campaigns[0];

		expect(userCampaign.actions).toEqual(
			expect.arrayContaining([campaign.actions[0], campaign.actions[1]])
		);
	});

	it("allows to query user campaign actions", async () => {
		const user = await User.query().insert(createUser());
		const campaignOne = await user
			.$relatedQuery("campaigns")
			.insert(createCampaign());
		await campaignOne.$relatedQuery("actions").insert(createActions());
		const campaignTwo = await user
			.$relatedQuery("campaigns")
			.insert(createCampaign());
		await campaignTwo.$relatedQuery("actions").insert(createActions());

		// Pretend we need to find the actions for campaignOne within just created user
		const createdUser = await User.query()
			.findById(user.id)
			.joinEager("campaigns.actions")
			.where("campaigns.id", campaignOne.id);
		const userCampaign = createdUser.campaigns[0];

		expect(createdUser.campaigns).toHaveLength(1);
		expect(userCampaign.actions).toEqual(
			expect.arrayContaining([campaignOne.actions[0], campaignOne.actions[1]])
		);
	});

	it("allows create 'UserAction' with given campaign, action and user id's", async () => {
		const targetedCampaign = await Campaign.query().insert(createCampaign());
		const targetedActions = await targetedCampaign
			.$relatedQuery("actions")
			.insert(createActions());
		const targetedUser = await User.query().insert(createUser());

		// Creates a UserAction from targeted data
		const userAction = await UserAction.query().insert({
			actionId: targetedActions[0].id,
			campaignId: targetedCampaign.id,
			userId: targetedUser.id
		});

		expect(userAction.id).toBeTruthy();
	});

	it("throws an error if trying to create a 'UserAction' with id's that doesn't map to valid entry", async () => {
		await expect(
			UserAction.query().insert({
				actionId: 400,
				campaignId: 400,
				userId: 400
			})
		).rejects.toBeTruthy();
	});
});
