import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SolanaTwitter } from '../target/types/solana_twitter';
import * as assert from 'assert';
import * as bs58 from 'bs58';

describe('solana-twitter', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // TS representation of SC in Mocha Test
  const program = anchor.workspace.SolanaTwitter as Program<SolanaTwitter>;

  // test #1 for sending tweet
  it('can send a new tweet!', async () => {
    // generate new account that stores memory of tweet
    const tweet = anchor.web3.Keypair.generate();

    // args first, context last ALWAYS tho defined oppositely
    await program.rpc.sendTweet('veganism', 'Hummus FTW', {
      accounts: {
        tweet: tweet.publicKey,
        // use localhost wallet
        author: program.provider.wallet.publicKey,
        // Anchor auto transform snake_case to camelCase
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      // in solana all TXs with all new accounts created (by convention)
      // Tweet account created owned by tweet account
      signers: [tweet],
    });

    // fetch account details of created tweet
    // program.account accesses all accounts created in SC
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);

    assert.equal(
      tweetAccount.author.toBase58(),
      program.provider.wallet.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, 'veganism');
    assert.equal(tweetAccount.content, 'Hummus FTW');
    assert.ok(tweetAccount.timestamp);
  });

  // test #2 for sending tweet
  it('can send tweet without topic!', async () => {
    // generate new account that stores memory of tweet
    const tweet = anchor.web3.Keypair.generate();

    // args first, context last ALWAYS tho defined oppositely
    await program.rpc.sendTweet('', 'gm', {
      accounts: {
        tweet: tweet.publicKey,
        author: program.provider.wallet.publicKey,
        // Anchor auto transform snake_case to camelCase
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [tweet],
    });

    // fetch account details of created tweet
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);

    assert.equal(
      tweetAccount.author.toBase58(),
      program.provider.wallet.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, '');
    assert.equal(tweetAccount.content, 'gm');
    assert.ok(tweetAccount.timestamp);
  });

  // test #3 for sending tweet from diff author
  it('can send tweet from diff author!', async () => {
    const otherUser = anchor.web3.Keypair.generate();
    // airdrop lamports to otherUser
    const sig = await program.provider.connection.requestAirdrop(
      otherUser.publicKey,
      1000000000
    );
    // wait to confirm tx sig, since airdrop is async
    await program.provider.connection.confirmTransaction(sig);

    // generate new account that stores memory of tweet
    const tweet = anchor.web3.Keypair.generate();

    // args first, context last ALWAYS tho defined oppositely
    await program.rpc.sendTweet('carnivore', 'loves lamb', {
      accounts: {
        tweet: tweet.publicKey,
        author: otherUser.publicKey,
        // Anchor auto transform snake_case to camelCase
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [tweet, otherUser],
    });

    // fetch account details of created tweet
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);

    assert.equal(
      tweetAccount.author.toBase58(),
      otherUser.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, 'carnivore');
    assert.equal(tweetAccount.content, 'loves lamb');
    assert.ok(tweetAccount.timestamp);
  });

  // test #4 for testing tweet topic (tweet not created)
  it('topic cannot be more than 50 chars!', async () => {
    try {
      // generate new account that stores memory of tweet
      const tweet = anchor.web3.Keypair.generate();
      const topicWith51Chars = 'x'.repeat(51);

      // args first, context last ALWAYS tho defined oppositely
      await program.rpc.sendTweet(topicWith51Chars, 'Hummus FTW', {
        accounts: {
          tweet: tweet.publicKey,
          // use localhost wallet
          author: program.provider.wallet.publicKey,
          // Anchor auto transform snake_case to camelCase
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
      });
    } catch (error) {
      assert.equal(
        error.msg,
        'The provided topic should be a max of 50 chars only'
      );
      return;
    }

    assert.fail('The instruction should have failed with 51 char topic');
  });

  // test #5 for testing tweet content (tweet not created)
  it('content cannot be more than 280 chars!', async () => {
    try {
      // generate new account that stores memory of tweet
      const tweet = anchor.web3.Keypair.generate();
      const contentChars = 'y'.repeat(281);

      // args first, context last ALWAYS tho defined oppositely
      await program.rpc.sendTweet('vegetarian', contentChars, {
        accounts: {
          tweet: tweet.publicKey,
          // use localhost wallet
          author: program.provider.wallet.publicKey,
          // Anchor auto transform snake_case to camelCase
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
      });
    } catch (error) {
      assert.equal(
        error.msg,
        'The provided content should be a max of 280 chars only'
      );
      return;
    }

    assert.fail('The instruction should have failed with 281 char content');
  });

  // test #7 get all filter by author
  it('can fetch all tweets', async () => {
    const tweetAccounts = await program.account.tweet.all();
    assert.equal(tweetAccounts.length, 3);
  });

  // test #7 fetch by author
  it('filter by author pub key', async () => {
    const authorPubKey = program.provider.wallet.publicKey;

    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8, // author is aft discriminator
          bytes: authorPubKey.toBase58(),
        },
      },
    ]);

    // 2 by author, 1 by otherUser
    assert.equal(tweetAccounts.length, 2);
    assert.ok(
      tweetAccounts.every((tweetAccount) => {
        return (
          tweetAccount.account.author.toBase58() === authorPubKey.toBase58()
        );
      })
    );
  });

  // test #7 get all filter by topic
  it('filter by topic', async () => {
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8 + 32 + 8 + 4, // see mem diagram
          bytes: bs58.encode(Buffer.from('veganism')),
        },
      },
    ]);

    assert.equal(tweetAccounts.length, 1);
    assert.ok(
      tweetAccounts.every((tweetAccount) => {
        return tweetAccount.account.topic === 'veganism';
      })
    );
  });
});
