import gql from 'graphql-tag';
import { PrismaSelect } from '../../src';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { getDMMFBySchemaPath } from '@paljs/utils';
import { join } from 'path';
import { ApolloServer, GraphQLRequest } from '@apollo/server';
import { Generators } from '@paljs/generator/src/Generators';
import { ExecuteOperationOptions, VariableValues } from '@apollo/server/dist/esm/externalTypes/graphql';
import { DocumentNode, TypedQueryDocumentNode } from 'graphql';

const typeDefs = gql`
  type User {
    id: Int!
    firstName: String!
    lastName: String!
    fullName: String
    email: String!
    password: String!
    posts(
      where: PostWhereInput
      orderBy: PostOrderByWithRelationInput
      cursor: PostWhereUniqueInput
      take: Int
      skip: Int
      distinct: PostScalarFieldEnum
    ): [Post!]!
    _count: UserCountOutputType!
  }

  type Post {
    id: Int!
    published: Boolean!
    title: String!
    author: User
    authorId: Int
    comments(
      where: CommentWhereInput
      orderBy: CommentOrderByWithRelationInput
      cursor: CommentWhereUniqueInput
      take: Int
      skip: Int
      distinct: CommentScalarFieldEnum
    ): [Comment!]!
    _count: PostCountOutputType!
  }

  type Comment {
    id: Int!
    contain: String!
    post: Post!
    postId: Int!
  }

  type Account {
    id: Int!
    firstName: String!
    lastName: String!
    newFieldNotInSchema: String
  }

  type Query {
    user(where: UserWhereUniqueInput): User
    account: Account
    aggregateUser: AggregateUser
    getNestedValue(value: String!, type: String!): User
    userWithDefaultValues: User
    userWithExcludeValues: User
  }
`;

const resolvers = {
  Query: {
    user: (_, __, ctx, info) => {
      const parsedResolveInfoFragment = parseResolveInfo(info);
      const select = new PrismaSelect(info, { dmmf: [ctx.dmmf] }).value;
      ctx.log({ parsedResolveInfoFragment, select });
      return null;
    },
    getNestedValue: (_, { value, type }, ctx, info) => {
      const select = new PrismaSelect(info, { dmmf: [ctx.dmmf] }).valueOf(value, type);
      ctx.log({ select });
      return null;
    },
    account: (_, __, ctx, info) => {
      const select = new PrismaSelect(info, { dmmf: [ctx.dmmf] }).value;
      ctx.log({ select });
      return null;
    },
    aggregateUser: (_, __, ctx, info) => {
      const select = new PrismaSelect(info, { dmmf: [ctx.dmmf] }).value;
      ctx.log({ select });
      return null;
    },
    userWithDefaultValues: (_, __, ctx, info) => {
      const select = new PrismaSelect<'User', { User: { firstName: string; lastName: string } }>(info, {
        dmmf: [ctx.dmmf],
        defaultFields: { User: { firstName: true, lastName: true } },
      }).value;
      ctx.log({ select });
      return null;
    },
    userWithExcludeValues: (_, __, ctx, info) => {
      const select = new PrismaSelect<'User', { User: { email: string; password: string } }>(info, {
        dmmf: [ctx.dmmf],
        excludeFields: { User: ['email', 'password'] },
      }).value;
      ctx.log({ select });
      return null;
    },
  },
};

export const executeOperation = async <
  TData = Record<string, unknown>,
  TVariables extends VariableValues = VariableValues,
>(
  request: Omit<GraphQLRequest<TVariables>, 'query'> & {
    query?: string | DocumentNode | TypedQueryDocumentNode<TData, TVariables>;
  },
  options?: ExecuteOperationOptions<any>,
) => {
  const schemaPath = join(__dirname, '../schemas/prismaSelect.prisma');
  const dmmf = await getDMMFBySchemaPath(schemaPath);
  const generator = new Generators(schemaPath);
  const inputs = gql`
    ${await generator.generateSDLInputsString()}
  `;
  const server = new ApolloServer({ typeDefs: [typeDefs, inputs], resolvers });
  let log: { parsedResolveInfoFragment: any; select: any } = { parsedResolveInfoFragment: undefined, select: {} };
  const result = await server.executeOperation(request, {
    contextValue: {
      dmmf,
      log: (o) => {
        log = o;
      },
    },
    ...options,
  });
  return { result, log };
};
