/** Exact independently reviewed Week 4 input pins; authenticity never grants acceptance or execution. */
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const WEEK4_PACKET = freeze({
  "scope": {
    "season": 2026,
    "season_type": "REG",
    "week": 4
  },
  "reviewedDataHead": "ca31f5052061e854b3df8ad46e555506f1f7712d",
  "reviewedDataTree": "7d3f8a4c2ce889258fa6be9eea48c5274c577012",
  "storageHead": "c924405c7043b07af5981a9683ac9a7df076e26d",
  "sourceSupportCommit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf",
  "producerCodeCommit": "0d9f82a8d0225602faea4887adf314983ee25a3a",
  "candidateGeneratedAt": "2026-10-06T11:14:16.885624Z",
  "qualifiedAt": "2026-10-06T11:43:10.583805Z",
  "candidatePath": "exports/candidates/weekly_boxscore/revisions/2026_REG_w04/307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9.json",
  "auditPath": "docs/audits/week4-preparation-2026-10-06/",
  "buildWitness": {
    "schema_version": "weekly_candidate_build_witness_v1",
    "kind": "new_candidate_materialization",
    "scope": {
      "season": 2026,
      "season_type": "REG",
      "week": 4
    },
    "build_started_at": "2026-10-06T11:14:16.662964+00:00",
    "build_completed_at": "2026-10-06T11:14:16.885624+00:00",
    "source_support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf",
    "schedule_support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf",
    "producer_code_commit": "0d9f82a8d0225602faea4887adf314983ee25a3a",
    "candidate_path": "exports/candidates/weekly_boxscore/revisions/2026_REG_w04/307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9.json",
    "candidate_sha256": "307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9",
    "status": "candidate_needs_review",
    "consumer_admitted": false,
    "independent_review": null,
    "purpose_acceptance": null
  },
  "inventoryMembers": [
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/LICENSE.md",
      "size": 18651,
      "sha256": "2a82ac9bbc3e3ee066908381e8d373896db5a6025d083fbd59692fe9ccfb9111",
      "git_blob_sha1": "0fb847eb09afc05734c2f1aa34bc3ebd995a072a",
      "support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf"
    },
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/player.csv",
      "size": 1981105,
      "sha256": "74dce52a31ffad854e516886bb16b39f88e02f77f292bca53e134ba5ec041cb4",
      "git_blob_sha1": "f558f0482ae5221d1940f1f3231b8d6af7ed60e3",
      "support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf"
    },
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/receipt.json",
      "size": 2061,
      "sha256": "c04414a446a14c4c8d2d9fdf04c1fd86831dd5c5c21171e7474660c3f67b5745",
      "git_blob_sha1": "488b51a9403c05bfaa44487e79394dbbc59b92ab",
      "support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf"
    },
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/team.csv",
      "size": 53166,
      "sha256": "5703ab3149d9be3ca9ae7e4ffa87411dcc9cccf0f542d3125b08a3e8b5eac391",
      "git_blob_sha1": "224d79506351ca0496aa3d63909af1256d957962",
      "support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf"
    },
    {
      "path": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/LICENSE.md",
      "size": 18651,
      "sha256": "2a82ac9bbc3e3ee066908381e8d373896db5a6025d083fbd59692fe9ccfb9111",
      "git_blob_sha1": "0fb847eb09afc05734c2f1aa34bc3ebd995a072a",
      "support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf"
    },
    {
      "path": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/games.csv",
      "size": 2182781,
      "sha256": "0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493",
      "git_blob_sha1": "1bc9f0f98fea33c67f2d1d0ff2f8241a7dffc8ee",
      "support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf"
    },
    {
      "path": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/receipt.json",
      "size": 1149,
      "sha256": "aafc68e301afd0fae9e663fd85ed03035934ce844a6593516773fdb698bc481c",
      "git_blob_sha1": "c184ea7a4478ee35b4409f28bddb5131298eeda7",
      "support_commit": "0f99ff5a2293044c41d5de3c2601c02baa6e9daf"
    },
    {
      "path": "exports/candidates/weekly_boxscore/revisions/2026_REG_w04/307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9.json",
      "size": 1335695,
      "sha256": "307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9",
      "git_blob_sha1": "2a6897d9cb75593c251e2ba68f90c9c5c9f3945a",
      "support_commit": null
    },
    {
      "path": "exports/candidates/weekly_boxscore/revisions/2026_REG_w04/index.json",
      "size": 156,
      "sha256": "9f1b4572d96464ea941d361c0ae9091e02f4617c2810e6858cedf584c1612de9",
      "git_blob_sha1": "03b4c10fc681d1eda6eb28fb9480ac8cf5656e7b",
      "support_commit": null
    },
    {
      "path": "scripts/intake_weekly_boxscore_v0.py",
      "size": 9503,
      "sha256": "1622fd838aaf07844d5c53655778a8a91945844bff15f1b07fb0488c26292322",
      "git_blob_sha1": "2751563ebda92ceddf8800ff6885877d9a4195ab",
      "support_commit": "0d9f82a8d0225602faea4887adf314983ee25a3a"
    },
    {
      "path": "scripts/intake_weekly_schedule_v0.py",
      "size": 5258,
      "sha256": "8b0f48a606bfd9ad13b6f902e5d08abf6a2ba956ce3bea6276b4bf02d3bdfcbd",
      "git_blob_sha1": "c77c6a39a3cdf470d4d2957395983f8504d6537a",
      "support_commit": "0d9f82a8d0225602faea4887adf314983ee25a3a"
    },
    {
      "path": "scripts/build_weekly_boxscore_candidate_v0.py",
      "size": 12594,
      "sha256": "e3195d836b2fcc77895ff05a8722f8fb24b50d0fdde50bf0b36730b9d8ef920d",
      "git_blob_sha1": "f68d031584fe0ed03557e04bd224ef5b6aa5560f",
      "support_commit": "0d9f82a8d0225602faea4887adf314983ee25a3a"
    },
    {
      "path": "scripts/publish_weekly_boxscore_candidate_v0.py",
      "size": 8330,
      "sha256": "dea7944cd57f38c4a2374e6072a726f4cd89cb1c685d430ecd9c061d66165d71",
      "git_blob_sha1": "a8843ac3fca3cbb46fc8beb97ab6aac0bec5a094",
      "support_commit": "0d9f82a8d0225602faea4887adf314983ee25a3a"
    }
  ],
  "pins": [
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/LICENSE.md",
      "size": 18651,
      "sha256": "2a82ac9bbc3e3ee066908381e8d373896db5a6025d083fbd59692fe9ccfb9111"
    },
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/player.csv",
      "size": 1981105,
      "sha256": "74dce52a31ffad854e516886bb16b39f88e02f77f292bca53e134ba5ec041cb4"
    },
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/receipt.json",
      "size": 2061,
      "sha256": "c04414a446a14c4c8d2d9fdf04c1fd86831dd5c5c21171e7474660c3f67b5745"
    },
    {
      "path": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/team.csv",
      "size": 53166,
      "sha256": "5703ab3149d9be3ca9ae7e4ffa87411dcc9cccf0f542d3125b08a3e8b5eac391"
    },
    {
      "path": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/LICENSE.md",
      "size": 18651,
      "sha256": "2a82ac9bbc3e3ee066908381e8d373896db5a6025d083fbd59692fe9ccfb9111"
    },
    {
      "path": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/games.csv",
      "size": 2182781,
      "sha256": "0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493"
    },
    {
      "path": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/receipt.json",
      "size": 1149,
      "sha256": "aafc68e301afd0fae9e663fd85ed03035934ce844a6593516773fdb698bc481c"
    },
    {
      "path": "exports/candidates/weekly_boxscore/revisions/2026_REG_w04/307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9.json",
      "size": 1335695,
      "sha256": "307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9"
    },
    {
      "path": "exports/candidates/weekly_boxscore/revisions/2026_REG_w04/index.json",
      "size": 156,
      "sha256": "9f1b4572d96464ea941d361c0ae9091e02f4617c2810e6858cedf584c1612de9"
    },
    {
      "path": "scripts/intake_weekly_boxscore_v0.py",
      "size": 9503,
      "sha256": "1622fd838aaf07844d5c53655778a8a91945844bff15f1b07fb0488c26292322"
    },
    {
      "path": "scripts/intake_weekly_schedule_v0.py",
      "size": 5258,
      "sha256": "8b0f48a606bfd9ad13b6f902e5d08abf6a2ba956ce3bea6276b4bf02d3bdfcbd"
    },
    {
      "path": "scripts/build_weekly_boxscore_candidate_v0.py",
      "size": 12594,
      "sha256": "e3195d836b2fcc77895ff05a8722f8fb24b50d0fdde50bf0b36730b9d8ef920d"
    },
    {
      "path": "scripts/publish_weekly_boxscore_candidate_v0.py",
      "size": 8330,
      "sha256": "dea7944cd57f38c4a2374e6072a726f4cd89cb1c685d430ecd9c061d66165d71"
    },
    {
      "path": "docs/audits/week4-preparation-2026-10-06/build-witness.json",
      "size": 882,
      "sha256": "e13a2c1679749d91b465864fd2be497a9e969e63a10b549a8c45ed51f260fe1c"
    },
    {
      "path": "docs/audits/week4-preparation-2026-10-06/input-inventory.json",
      "size": 4859,
      "sha256": "851d188aaf60a65cd39ef6fd0a4541f40aa4196010c68872edb028437a2d03e7"
    },
    {
      "path": "docs/audits/week4-preparation-2026-10-06/independent-review.json",
      "size": 3572,
      "sha256": "339e8690fb7d117354f0dc5be1a8e272e426517eb9303d28d29effec11ab8d13"
    }
  ],
  "games": [
    "2026_04_ARI_NYG",
    "2026_04_ATL_NO",
    "2026_04_DAL_HOU",
    "2026_04_DEN_SF",
    "2026_04_DET_CAR",
    "2026_04_GB_TB",
    "2026_04_IND_WAS",
    "2026_04_JAX_CIN",
    "2026_04_KC_LV",
    "2026_04_LAC_SEA",
    "2026_04_LA_PHI",
    "2026_04_MIA_MIN",
    "2026_04_NE_BUF",
    "2026_04_NYJ_CHI",
    "2026_04_PIT_CLE",
    "2026_04_TEN_BAL"
  ],
  "paths": {
    "candidate": "exports/candidates/weekly_boxscore/revisions/2026_REG_w04/307204e4c8123e8b1f66d8dabbacfb5310ad84b72abfa935b15f0fd4e5016de9.json",
    "player": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/player.csv",
    "team": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/team.csv",
    "schedule": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/games.csv",
    "sourceReceipt": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/receipt.json",
    "scheduleReceipt": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/receipt.json",
    "sourceLicense": "data/raw/weekly_boxscore/2026_w04_bb25cc8270b1082e531c4bd9a229584d9d952e6eaf0397ea2781a79a00017ca4/LICENSE.md",
    "scheduleLicense": "data/raw/weekly_schedule/0de841abf2ee694fb1baa779f35a3a702bfce6bd83d252c26375f13468b4d493/LICENSE.md",
    "publisher": "scripts/publish_weekly_boxscore_candidate_v0.py",
    "builder": "scripts/build_weekly_boxscore_candidate_v0.py"
  }
});
