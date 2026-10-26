// 由 scripts/export-demo.ts 生成，请勿手改
window.P0_DEMO = {
  "project": "智能知识库问答平台",
  "generatedAt": "2026-10-26T09:00:00.000Z",
  "settings": {
    "maxNodesPerView": 40,
    "stuckDays": 5,
    "testTimeoutSec": 300,
    "tokenCount": "processed",
    "runners": {
      ".sh": "bash {file}"
    }
  },
  "metrics": {
    "total": 23,
    "built": 12,
    "effective": 9
  },
  "nodes": [
    {
      "id": "f-login",
      "name": "账号登录",
      "view": "functional",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1",
        "G2"
      ]
    },
    {
      "id": "f-upload",
      "name": "上传文档",
      "view": "functional",
      "status": "doing",
      "state": "doing",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "kb",
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "f-ask",
      "name": "基于文档问答",
      "view": "functional",
      "status": "doing",
      "state": "doing",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "f-upload",
        "kb",
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "f-cite",
      "name": "查看引用",
      "view": "functional",
      "status": "todo",
      "state": "todo",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": []
    },
    {
      "id": "f-billing",
      "name": "按用量计费",
      "view": "functional",
      "status": "todo",
      "state": "todo",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "bill",
        "dash"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G3"
      ]
    },
    {
      "id": "login",
      "name": "登录页",
      "view": "logical",
      "layer": "front",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 180000,
      "days": 0,
      "goals": [
        "G1",
        "G2"
      ]
    },
    {
      "id": "chatui",
      "name": "对话界面",
      "view": "logical",
      "layer": "front",
      "status": "done",
      "state": "blocked",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "kb",
      "name": "知识库管理台",
      "view": "logical",
      "layer": "front",
      "status": "doing",
      "state": "doing",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "tokens": 610000,
      "days": 6,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "dash",
      "name": "数据看板",
      "view": "logical",
      "layer": "front",
      "status": "todo",
      "state": "todo",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "bill"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G3"
      ]
    },
    {
      "id": "auth",
      "name": "用户认证",
      "view": "logical",
      "layer": "service",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": true,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1",
        "G2"
      ]
    },
    {
      "id": "chatsvc",
      "name": "对话服务",
      "view": "logical",
      "layer": "service",
      "status": "done",
      "state": "blocked",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "tokens": 520000,
      "days": 5,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "retr",
      "name": "向量检索",
      "view": "logical",
      "layer": "service",
      "status": "todo",
      "state": "todo",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "p-pgvec",
        "vdb"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "parse",
      "name": "文档解析",
      "view": "logical",
      "layer": "service",
      "status": "done",
      "state": "blocked",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "bill",
      "name": "计费服务",
      "view": "logical",
      "layer": "service",
      "status": "todo",
      "state": "todo",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G3"
      ]
    },
    {
      "id": "userdb",
      "name": "用户库",
      "view": "logical",
      "layer": "data",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1",
        "G2",
        "G3"
      ]
    },
    {
      "id": "vdb",
      "name": "向量数据库",
      "view": "logical",
      "layer": "data",
      "status": "todo",
      "state": "todo",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [
        "p-pgvec"
      ],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "oss",
      "name": "对象存储",
      "view": "logical",
      "layer": "data",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "llm",
      "name": "LLM 网关",
      "view": "logical",
      "layer": "external",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "p-pg",
      "name": "PG 主库",
      "view": "physical",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1",
        "G2",
        "G3"
      ]
    },
    {
      "id": "p-pgvec",
      "name": "PG 向量实例",
      "view": "physical",
      "status": "todo",
      "state": "todo",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "p-s3",
      "name": "S3 存储桶",
      "view": "physical",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "p-app-1",
      "name": "应用服务器 1",
      "view": "physical",
      "status": "done",
      "state": "ok",
      "effective": true,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    },
    {
      "id": "p-app-2",
      "name": "应用服务器 2",
      "view": "physical",
      "status": "doing",
      "state": "doing",
      "effective": false,
      "crossViewBlocked": false,
      "pendingReview": false,
      "rootBlockers": [],
      "tokens": 0,
      "days": 0,
      "goals": [
        "G1"
      ]
    }
  ],
  "edges": [
    {
      "from": "f-ask",
      "to": "f-upload",
      "kind": "hard"
    },
    {
      "from": "login",
      "to": "auth",
      "kind": "hard"
    },
    {
      "from": "chatui",
      "to": "chatsvc",
      "kind": "hard"
    },
    {
      "from": "kb",
      "to": "parse",
      "kind": "hard"
    },
    {
      "from": "dash",
      "to": "bill",
      "kind": "hard"
    },
    {
      "from": "auth",
      "to": "userdb",
      "kind": "hard"
    },
    {
      "from": "chatsvc",
      "to": "retr",
      "kind": "hard"
    },
    {
      "from": "chatsvc",
      "to": "llm",
      "kind": "hard"
    },
    {
      "from": "retr",
      "to": "vdb",
      "kind": "hard"
    },
    {
      "from": "parse",
      "to": "oss",
      "kind": "hard"
    },
    {
      "from": "parse",
      "to": "retr",
      "kind": "hard"
    },
    {
      "from": "bill",
      "to": "userdb",
      "kind": "hard"
    },
    {
      "from": "f-login",
      "to": "login",
      "kind": "realized_by",
      "require": "all"
    },
    {
      "from": "f-upload",
      "to": "kb",
      "kind": "realized_by",
      "require": "all"
    },
    {
      "from": "f-ask",
      "to": "chatui",
      "kind": "realized_by",
      "require": "all"
    },
    {
      "from": "f-billing",
      "to": "dash",
      "kind": "realized_by",
      "require": "all"
    },
    {
      "from": "userdb",
      "to": "p-pg",
      "kind": "deployed_on",
      "require": "all"
    },
    {
      "from": "vdb",
      "to": "p-pgvec",
      "kind": "deployed_on",
      "require": "all"
    },
    {
      "from": "oss",
      "to": "p-s3",
      "kind": "deployed_on",
      "require": "all"
    },
    {
      "from": "chatsvc",
      "to": "p-app-1",
      "kind": "deployed_on",
      "require": "any"
    },
    {
      "from": "chatsvc",
      "to": "p-app-2",
      "kind": "deployed_on",
      "require": "any"
    }
  ],
  "goals": [
    {
      "id": "G1",
      "name": "用户能基于自有文档提问并得到答案",
      "total": 19,
      "effectiveCount": 9,
      "ratio": 0.47368421052631576,
      "toBuild": [
        "f-ask",
        "f-upload",
        "kb",
        "p-app-2",
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "blocked": [
        "chatsvc",
        "chatui",
        "parse"
      ]
    },
    {
      "id": "G2",
      "name": "用户能安全登录与管理账号",
      "total": 5,
      "effectiveCount": 5,
      "ratio": 1,
      "toBuild": [],
      "blocked": []
    },
    {
      "id": "G3",
      "name": "平台可按用量计费",
      "total": 5,
      "effectiveCount": 2,
      "ratio": 0.4,
      "toBuild": [
        "bill",
        "dash",
        "f-billing"
      ],
      "blocked": []
    }
  ],
  "recommendations": [
    {
      "target": "f-billing",
      "plan": [
        "bill",
        "dash",
        "f-billing"
      ],
      "gain": 60,
      "leverage": 20,
      "goalDeltas": [
        {
          "goal": "G3",
          "before": 0.4,
          "after": 1
        }
      ],
      "unblocked": [
        "bill",
        "dash",
        "f-billing"
      ]
    },
    {
      "target": "dash",
      "plan": [
        "bill",
        "dash"
      ],
      "gain": 40,
      "leverage": 20,
      "goalDeltas": [
        {
          "goal": "G3",
          "before": 0.4,
          "after": 0.8
        }
      ],
      "unblocked": [
        "bill",
        "dash"
      ]
    },
    {
      "target": "bill",
      "plan": [
        "bill"
      ],
      "gain": 19.999999999999996,
      "leverage": 19.999999999999996,
      "goalDeltas": [
        {
          "goal": "G3",
          "before": 0.4,
          "after": 0.6
        }
      ],
      "unblocked": [
        "bill"
      ]
    },
    {
      "target": "retr",
      "plan": [
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "gain": 31.578947368421055,
      "leverage": 10.526315789473685,
      "goalDeltas": [
        {
          "goal": "G1",
          "before": 0.47368421052631576,
          "after": 0.7894736842105263
        }
      ],
      "unblocked": [
        "chatsvc",
        "chatui",
        "p-pgvec",
        "parse",
        "retr",
        "vdb"
      ]
    },
    {
      "target": "kb",
      "plan": [
        "kb",
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "gain": 36.84210526315789,
      "leverage": 9.210526315789473,
      "goalDeltas": [
        {
          "goal": "G1",
          "before": 0.47368421052631576,
          "after": 0.8421052631578947
        }
      ],
      "unblocked": [
        "chatsvc",
        "chatui",
        "kb",
        "p-pgvec",
        "parse",
        "retr",
        "vdb"
      ]
    },
    {
      "target": "f-upload",
      "plan": [
        "f-upload",
        "kb",
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "gain": 42.10526315789474,
      "leverage": 8.421052631578949,
      "goalDeltas": [
        {
          "goal": "G1",
          "before": 0.47368421052631576,
          "after": 0.8947368421052632
        }
      ],
      "unblocked": [
        "chatsvc",
        "chatui",
        "f-upload",
        "kb",
        "p-pgvec",
        "parse",
        "retr",
        "vdb"
      ]
    },
    {
      "target": "f-ask",
      "plan": [
        "f-ask",
        "f-upload",
        "kb",
        "p-pgvec",
        "retr",
        "vdb"
      ],
      "gain": 47.368421052631575,
      "leverage": 7.894736842105263,
      "goalDeltas": [
        {
          "goal": "G1",
          "before": 0.47368421052631576,
          "after": 0.9473684210526315
        }
      ],
      "unblocked": [
        "chatsvc",
        "chatui",
        "f-ask",
        "f-upload",
        "kb",
        "p-pgvec",
        "parse",
        "retr",
        "vdb"
      ]
    },
    {
      "target": "vdb",
      "plan": [
        "p-pgvec",
        "vdb"
      ],
      "gain": 10.526315789473689,
      "leverage": 5.263157894736844,
      "goalDeltas": [
        {
          "goal": "G1",
          "before": 0.47368421052631576,
          "after": 0.5789473684210527
        }
      ],
      "unblocked": [
        "p-pgvec",
        "vdb"
      ]
    },
    {
      "target": "p-app-2",
      "plan": [
        "p-app-2"
      ],
      "gain": 5.263157894736842,
      "leverage": 5.263157894736842,
      "goalDeltas": [
        {
          "goal": "G1",
          "before": 0.47368421052631576,
          "after": 0.5263157894736842
        }
      ],
      "unblocked": [
        "p-app-2"
      ]
    },
    {
      "target": "p-pgvec",
      "plan": [
        "p-pgvec"
      ],
      "gain": 5.263157894736842,
      "leverage": 5.263157894736842,
      "goalDeltas": [
        {
          "goal": "G1",
          "before": 0.47368421052631576,
          "after": 0.5263157894736842
        }
      ],
      "unblocked": [
        "p-pgvec"
      ]
    }
  ],
  "cost": {
    "nodes": {
      "chatsvc": {
        "tokens": 520000,
        "days": 5
      },
      "kb": {
        "tokens": 610000,
        "days": 6
      },
      "login": {
        "tokens": 180000,
        "days": 0
      }
    },
    "totalTokens": 1310000,
    "sunkTokens": 1130000,
    "byState": {
      "ok": 180000,
      "blocked": 520000,
      "doing": 610000,
      "todo": 0
    },
    "byGoal": {
      "G1": 1310000,
      "G2": 180000,
      "G3": 0
    },
    "stuck": [
      "kb"
    ],
    "unknownNodes": [],
    "unassignedTokens": 0
  },
  "blueprints": [
    {
      "goal": "G1",
      "steps": [
        {
          "step": "登录",
          "functional": "f-login",
          "slice": "now",
          "lanes": {
            "front": [
              "login"
            ],
            "back": [
              "auth"
            ],
            "support": [
              "userdb",
              "p-pg"
            ]
          },
          "status": "ok",
          "root": null
        },
        {
          "step": "上传文档",
          "functional": "f-upload",
          "slice": "now",
          "lanes": {
            "front": [
              "kb"
            ],
            "back": [
              "retr",
              "parse"
            ],
            "support": [
              "vdb",
              "oss",
              "p-pgvec",
              "p-s3"
            ]
          },
          "status": "broken",
          "root": "p-pgvec"
        },
        {
          "step": "提问",
          "functional": "f-ask",
          "slice": "now",
          "lanes": {
            "front": [
              "chatui"
            ],
            "back": [
              "chatsvc",
              "retr"
            ],
            "support": [
              "vdb",
              "llm",
              "p-pgvec",
              "p-app-1",
              "p-app-2"
            ]
          },
          "status": "broken",
          "root": "p-pgvec"
        },
        {
          "step": "查看引用",
          "functional": "f-cite",
          "slice": "later",
          "lanes": {
            "front": [],
            "back": [],
            "support": []
          },
          "status": "gap",
          "root": null
        }
      ],
      "summary": {
        "inScope": 3,
        "usable": 1
      }
    }
  ],
  "warnings": []
};
