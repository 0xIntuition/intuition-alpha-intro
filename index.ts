import { consola } from 'consola'
import { createClient, newDIDSessionFromPrivateKey } from '@0xintuition/api'
import { arbitrumGoerli } from 'viem/chains'
import pino from 'pino'

// const API_BASE_URL = 'http://api.intuition.cafe'
const API_BASE_URL = 'http://localhost:8080'

const log = pino()
consola.options.formatOptions.colors = true

async function main() {
  /**
   * Let's build an app called.....
   *
   * ░▀█▀░█▀█░▀█▀░█▀▀░█▀▄░█▀█░█▀▀░▀█▀░░░█▀█░█▄█░▀█▀░█▀▀░█▀█░█▀▀
   * ░░█░░█░█░░█░░█▀▀░█▀▄░█░█░█▀▀░░█░░░░█▀█░█░█░░█░░█░█░█░█░▀▀█
   * ░▀▀▀░▀░▀░░▀░░▀▀▀░▀░▀░▀░▀░▀▀▀░░▀░░░░▀░▀░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀
   *
   * An app is no fun by yourself, let's create clients for two users...
   */
  log.info(`Let's build 'Internet Amigos' on Intuition!`)
  const session1 = await newDIDSessionFromPrivateKey(
    process.env.PRIVATE_KEY! as `0x${string}`,
    { chainId: arbitrumGoerli.id.toString() }
  )
  log.info('prepare for api interactions:')
  log.info({ session1: session1.serialize() }, '- session 1')
  const session2 = await newDIDSessionFromPrivateKey(
    process.env.PRIVATE_KEY_2! as `0x${string}`,
    { chainId: arbitrumGoerli.id.toString() }
  )
  log.info({ session2: session2.serialize() }, '- session 2')
  const client1 = createClient({
    url: API_BASE_URL,
    apiKey: process.env.API_KEY,
    session: session1.serialize(),
  })
  log.info('- client 1')
  const client2 = createClient({
    url: API_BASE_URL,
    apiKey: process.env.API_KEY_2,
    session: session2.serialize(),
  })
  log.info('- client 2')
  log.info('preparation complete')
  /**
   * Alrighty so all good apps have a way to identify users within the system, let's follow suit!
   *
   * To do this, we'll create an identity for each user with the following fields:
   *  display_name: My User <n>
   *  description: I <3 Intuition
   */
  // try creating both users
  log.info('creating users if needed...')
  try {
    await client1.identity.create.mutate({
      display_name: 'My User',
      description: 'I <3 Intuition',
    })
  } catch (e) {
    log.warn('"My User" already created')
  }
  try {
    await client1.identity.create.mutate({
      display_name: 'My Other User',
      description: 'I <3 Intuition',
    })
  } catch (e) {
    log.warn('"My Other User" already created')
  }
  // retrieve both users
  let {
    data: [user1],
  } = await client1.queries.identities.query({
    input: { display_name: { op: '=', value: 'My User' } },
  })
  let {
    data: [user2],
  } = await client2.queries.identities.query({
    input: { display_name: { op: '=', value: 'My Other User' } },
  })
  log.info({ user1 }, 'retrieved My User')
  log.info({ user2 }, 'retrieved My Other User')
  /**
   * Let's create a claim:
   *        <user> --> "Esteemed Guest" --> Internet Amigos
   *
   * This will allow us to target only the users of "Internet Amigos" rather
   * than targeting all identities on Intuition.
   *
   * The predicate "Esteemed Guest" is what we call a "special predicate"
   * A **special predicate** is nothing too special, it's just an identity that we've assigned additional significance to.
   */
  // create the "Esteemed Guest" and "Internet Amigos" identities
  try {
    await client1.identity.create.mutate({
      display_name: 'Esteemed Guest',
      description: 'I <3 Intuition',
    })
  } catch (e) {
    log.warn('identity "Esteemed Guest" already created')
  }
  try {
    await client1.identity.create.mutate({
      display_name: 'Internet Amigos',
      description: 'I <3 Intuition',
    })
  } catch (e) {
    log.warn('identity "Internet Amigos" already created')
  }
  // retrieve the "Esteemed Guest" and "Internet Amigos" identities
  const {
    data: [userPredicateIdentity],
  } = await client1.queries.identities.query({
    input: { display_name: { op: '=', value: 'Esteemed Guest' } },
  })
  log.info({ userPredicateIdentity }, 'retrieved the "Esteemed Guest" identity')
  const {
    data: [internetAmigosIdentity],
  } = await client1.queries.identities.query({
    input: { display_name: { op: '=', value: 'Internet Amigos' } },
  })
  log.info(
    { internetAmigosIdentity },
    'retrieved the "Internet Amigos" identity'
  )
  // create the claims
  try {
    const { data: userClaim1 } = await client1.claim.create.mutate({
      subject_id: user1.identity_id,
      predicate_id: userPredicateIdentity.identity_id,
      object_id: internetAmigosIdentity.identity_id,
      direction: true,
    })
    log.info(
      { userClaim1 },
      'created claim "My User" --> "Esteemed Guest" --> "Internet Amigos"'
    )
    await client1.claim.attest.mutate({
      claim_id: userClaim1.claim_id,
      direction: true,
    })
    log.info('attested to claim')
  } catch (e) {}
  try {
    const { data: userClaim2 } = await client2.claim.create.mutate({
      subject_id: user2.identity_id,
      predicate_id: userPredicateIdentity.identity_id,
      object_id: internetAmigosIdentity.identity_id,
      direction: true,
    })
    log.info(
      { userClaim2 },
      'created claim "My Other User" --> "Esteemed Guest" --> "Internet Amigos"'
    )
    await client2.claim.attest.mutate({
      claim_id: userClaim2.claim_id,
      direction: true,
    })
    log.info('attested to claim')
  } catch (e) {}

  /**
   * Let's verify that the above worked.
   * To do so, we need to execute a query that filters identities based on the claims they appear in.
   *
   * Concretely, we need to query all identities that:
   * - Appear in a claim as the Subject
   * - The claim's predicate display_name is 'User'
   * - The claim's object display_name is 'Internet Amigos'
   */
  const { data: allAppUsers } = await client1.queries.identities.query({
    input: {
      in_claim: {
        as_subject: {
          where_predicate: {
            display_name: { op: '=', value: 'Esteemed Guest' },
          },
          where_object: {
            display_name: { op: '=', value: 'Internet Amigos' },
          },
        },
      },
    },
  })
  log.info({ allAppUsers }, 'retrieved all "Internet Amigos" users')

  /**
   * Wow! Isn't that nuts? We have our own data space inside of Intuition for identities.
   * Let's build off of it!
   *
   * Every good app needs User Profiles, however they are
   * typically rigid on which fields they contain.
   *
   * Luckily, Intuituition isn't typical 😉
   *
   * Let's see how both users can have complete control over
   * what fields their profiles contain.
   *
   * "My User" wants the fields "Favorite Ice Cream" and "Shoe Width"
   * "My Other User" wants the fields "Worst Superhero" and "Sense of Smell Ranking"
   *
   * We're going to use another **special predicate** here called "Internet Amigos Profile"
   * to designate what makes up a user's profile
   */

  /**
   * **special predicate: Internet Amigos Profile**
   */
  try {
    const { data: profileIdentity } = await client1.identity.create.mutate({
      display_name: 'Internet Amigos Profile',
      description:
        'User Profiles for the "Internet Amigos" application on Intuition',
    })
    log.info({ profileIdentity }, 'created "Profile" special predicate')
  } catch (e) {
    log.warn('profile identity already created')
  }
  let {
    data: [profileIdentity],
  } = await client1.queries.identities.query({
    input: { display_name: { op: '=', value: 'Internet Amigos Profile' } },
  })

  // "My User" profile pointer and field names
  try {
    const { data: user1ProfilePointerIdentity } =
      await client1.identity.create.mutate({
        display_name: 'PROFILE1: My User',
        description: 'first profile for "My User"',
      })
    log.info(
      { user1ProfilePointerIdentity },
      'created "My User" profile pointer'
    )
    log.info('creating profile field and value identities...')
    const { data: user1IceCreamField } = await client1.identity.create.mutate({
      display_name: 'Favorite Ice Cream',
      description: 'What is your top flavor?',
    })
    const { data: user1IceCreamValue } = await client1.identity.create.mutate({
      display_name: 'Superman',
      description:
        'Man of steel (or delicious combo of blue moon, lemon, and black cherry ice cream)',
    })
    const { data: user1FootWidthField } = await client1.identity.create.mutate({
      display_name: 'Shoe Width',
      description: 'How wide are those tootsies?',
    })
    const { data: user1FootWidthValue } = await client1.identity.create.mutate({
      display_name: 'Fred Flinstone',
      description: 'Yabba Dabba Dooooooooooo!',
    })
    // "My User" fields are tied to the profile pointer via claims
    // "PROFILE1: My User" --> "Favorite Ice Cream" --> "Superman"
    const { data: user1IceCreamClaim } = await client1.claim.create.mutate({
      subject_id: user1ProfilePointerIdentity.identity_id,
      predicate_id: user1IceCreamField.identity_id,
      object_id: user1IceCreamValue.identity_id,
      direction: true,
    })
    // "PROFILE1: My User" --> "Foot Width" --> "Fred Flintstone"
    const { data: user1FootWidthClaim } = await client1.claim.create.mutate({
      subject_id: user1ProfilePointerIdentity.identity_id,
      predicate_id: user1FootWidthField.identity_id,
      object_id: user1FootWidthValue.identity_id,
      direction: true,
    })
    /**
     * Finally, connect "My User" with the profile pointer "PROFILE1: My User"
     */
    log.info('creating "My User" profile claim...')
    const { data: user1ProfileClaim } = await client1.claim.create.mutate({
      subject_id: user1.identity_id,
      predicate_id: profileIdentity.identity_id,
      object_id: user1ProfilePointerIdentity.identity_id,
      direction: true,
    })
    log.info('"My User" profile created!')
  } catch (e) {
    log.warn('user 1 profile already created')
  }
  let {
    data: [user1IceCreamValue],
  } = await client1.queries.identities.query({
    input: { display_name: { op: '=', value: 'Superman' } },
  })

  /**
   * Now let's do the same for "My Other User"
   */
  // "My User" profile pointer and field names
  try {
    const { data: user2ProfilePointerIdentity } =
      await client2.identity.create.mutate({
        display_name: 'PROFILE2: My Other User',
        description: 'first profile for "My Other User"',
      })
    log.info(
      { user2ProfilePointerIdentity },
      'created "My Other User" profile pointer'
    )
    log.info('creating profile field and value identities...')
    const { data: user2SuperheroField } = await client2.identity.create.mutate({
      display_name: 'Worst Superhero',
      description: 'We all know who it is (Superman)',
    })
    /**
     * Instead of having to create a new identity as
     * the value for "My Other User"'s "Worst Superhero" field, we can
     * leverage the pre-existing "Superman" identity that "My User" just created!
     *
     * A core principal of Intuition is minimizing fragmentation of attestations, which benefits us all by:
     * - generating clearer, stronger signals
     * - simplifying querying and data ingestion overhead
     * - unifying contributors of information within a specific topic (identity)
     *
     */
    const user2SuperheroValueID = user1IceCreamValue.identity_id
    const { data: user2SmellField } = await client2.identity.create.mutate({
      display_name: 'Sense of Smell Ranking (global)',
      description: "Noses aren't just for picking!",
    })
    const { data: user2SmellValue } = await client2.identity.create.mutate({
      display_name: 'TOP!',
      description: 'Here we are...',
    })
    // "My User" fields are tied to the profile pointer via claims
    // "PROFILE1: My Other User" --> "Worst Superhero" --> "Superman"
    const { data: user2SuperheroClaim } = await client2.claim.create.mutate({
      subject_id: user2ProfilePointerIdentity.identity_id,
      predicate_id: user2SuperheroField.identity_id,
      object_id: user2SuperheroValueID,
      direction: true,
    })
    // "PROFILE1: My Other User" --> "Sense of Smell Ranking (global)" --> "TOP!"
    const { data: user2SmellClaim } = await client2.claim.create.mutate({
      subject_id: user2ProfilePointerIdentity.identity_id,
      predicate_id: user2SmellField.identity_id,
      object_id: user2SmellValue.identity_id,
      direction: true,
    })
    /**
     * Finally, connect "My Other User" with the profile pointer "PROFILE1: My User"
     */
    log.info('creating "My Other User" profile claim...')
    const { data: user2ProfileClaim } = await client2.claim.create.mutate({
      subject_id: user2.identity_id,
      predicate_id: profileIdentity.identity_id,
      object_id: user2ProfilePointerIdentity.identity_id,
      direction: true,
    })
    log.info('"My Other User" profile created!')
  } catch (e) {
    log.warn('user 2 profile already created')
  }

  /**
   * Now that we've created all these profiles....
   *
   * HOW IN THE HECK DO WE QUERY THEM?!
   *
   * Welp, it's a two-parter
   *
   * Step 1: Get the profile pointer identities
   * Step 2: Contstruct the profile fields from the claims they're involved in
   */

  // First off, let's get "My User 1's identity"
  log.info('getting My User 1 identity')
  const {
    data: [mu1],
  } = await client1.queries.identities.query({
    input: { display_name: { op: '=', value: 'My User 1' } },
  })

  // Now let's get the profile pointer
  log.info('getting My User 1 profile pointer')
  const {
    data: [{ object_id: pp }],
  } = await client1.queries.claims.query({
    input: {
      with_subject: {
        display_name: { op: '=', value: 'My User 1' },
      },
      with_predicate: {
        display_name: { op: '=', value: 'Internet Amigos Profile' },
      },
    },
  })

  // Now let's get the profile claims
  const { data: profileClaims } = await client1.queries.claims.query({
    input: {
      with_subject: {
        identity_id: { op: '=', value: pp },
      },
    },
  })

  // Finally let's reconstruct the profile
  let profile: Record<string, string> = {}
  for (const claim of profileClaims) {
    console.log(claim)
    const { data: field } = await client1.identity.get.query({
      identity_id: claim.predicate_id,
    })
    const { data: value } = await client1.identity.get.query({
      identity_id: claim.object_id,
    })
    profile[field.display_name] = value.display_name
  }
  log.info({ profile })
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    log.error(e)
    process.exit(1)
  })
