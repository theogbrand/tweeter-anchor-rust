use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

// program account's public key avail after build + deploy
declare_id!("78ummy2JP8DzTJVvN6eHAsYMrxrft8orFncAJubVxVmn");

// the SC, also an account - also entry point
#[program]
pub mod solana_twitter {
    use super::*;
    // Assumes Context handles all data validation so functions will only define biz logic
    // when enter function we assume all data is sanitised and usable, otherwise not entered
    pub fn send_tweet(ctx: Context<SendTweet>, topic: String, content: String) -> ProgramResult {

        // extract all accounts that instruction needs from context
        let tweet: &mut Account<Tweet> = &mut ctx.accounts.tweet;

        // & for references 
        let author: &Signer = &ctx.accounts.author;
        let clock: Clock = Clock::get().unwrap();

        // sanitise topic/content
        if topic.chars().count() > 50 {
            return Err(ErrorCode::TopicTooLong.into())
        }
        if content.chars().count() > 280 {
            return Err(ErrorCode::ContentTooLong.into())
        }

        // fill tweet account with right data, *dereference cos passing by value not ref
        tweet.author = *author.key;
        tweet.timestamp = clock.unix_timestamp;
        tweet.topic = topic;
        tweet.content = content;

        // if returning value, put inside Ok((type)), hence no need for return keyword
        Ok(())
    }
}

// account context (middleware for instructions) corresponding to each instruction
#[derive(Accounts)]
pub struct SendTweet<'info> {
    // account constraints - attributes on account props for security and access control
    #[account(init, payer=author, space=Tweet::LEN)]
    // passing Account of the creator of the Tweet, who will be the Author's Account
    pub tweet: Account<'info, Tweet>,
    #[account(mut)]
    // always need a signer for account created
    pub author: Signer<'info>,
    #[account(address=system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

// single account storing each tweet, paid by author - like model (storage layout)
#[account]
pub struct Tweet {
    pub author: Pubkey,
    pub timestamp: i64,
    pub topic: String,
    pub content: String,
}

const DISCRIMINATOR_LENGTH: usize = 8; // what account is this? UserAccount? Tweet? 
const PUBLIC_KEY_LENGTH: usize = 32; // by definition
const TIMESTAMP_LENGTH: usize = 8; // by definition
const STRING_LENGTH_PREFIX: usize = 4; // Stores the ACTUAL size of the string (topic/content) so know where to stop, cos vecs have no limits
const MAX_TOPIC_LENGTH: usize = 50 * 4; // 50 chars max - arbitrary
const MAX_CONTENT_LENGTH: usize = 280 * 4; // 280 chars max - arbitrary

impl Tweet {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH // Author.
        + TIMESTAMP_LENGTH // Timestamp.
        + STRING_LENGTH_PREFIX + MAX_TOPIC_LENGTH // Topic.
        + STRING_LENGTH_PREFIX + MAX_CONTENT_LENGTH; // Content.
}

#[error]
pub enum ErrorCode {
    #[msg("The provided topic should be a max of 50 chars only")]
    TopicTooLong,
    #[msg("The provided content should be a max of 280 chars only")]
    ContentTooLong,
}